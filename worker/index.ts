import { createLogger } from './logger';
import { isDispatcherAvailable } from './utils/dispatcherUtils';
import { createApp } from './app';
// import * as Sentry from '@sentry/cloudflare';
// import { sentryOptions } from './observability/sentry';
import { DORateLimitStore as BaseDORateLimitStore } from './services/rate-limit/DORateLimitStore';
import { getPreviewDomain } from './utils/urls';
import { proxyToAiGateway } from './services/aigateway-proxy/controller';
import { isOriginAllowed, getPreviewSecurityHeaders, buildSecurityHeaders } from './config/security';
import { proxyToSandbox } from './services/sandbox/request-handler';
import { handleGitProtocolRequest, isGitProtocolRequest } from './api/handlers/git-protocol';
import { getAgentStub } from './agents';

// Durable Object and Service exports
export { UserAppSandboxService } from './services/sandbox/sandboxSdkClient';
export { CodeGeneratorAgent } from './agents/core/codingAgent';
export { UserSecretsStore } from './services/secrets/UserSecretsStore';

// export const CodeGeneratorAgent = Sentry.instrumentDurableObjectWithSentry(sentryOptions, CodeGeneratorAgent);
// export const DORateLimitStore = Sentry.instrumentDurableObjectWithSentry(sentryOptions, BaseDORateLimitStore);
export const DORateLimitStore = BaseDORateLimitStore;

// Logger for the main application and handlers
const logger = createLogger('App');

function setOriginControl(env: Env, request: Request, currentHeaders: Headers): Headers {
    const origin = request.headers.get('Origin');
    
    if (origin && isOriginAllowed(env, origin)) {
        currentHeaders.set('Access-Control-Allow-Origin', origin);
    }
    return currentHeaders;
}

/**
 * Handles requests for user-deployed applications on subdomains.
 * It first attempts to proxy to a live development sandbox. If that fails,
 * it dispatches the request to a permanently deployed worker via namespaces.
 * This function will NOT fall back to the main worker.
 *
 * @param request The incoming Request object.
 * @param env The environment bindings.
 * @returns A Response object from the sandbox, the dispatched worker, or an error.
 */
async function handleUserAppRequest(request: Request, env: Env): Promise<Response> {
	const url = new URL(request.url);
	const { hostname, pathname } = url;
	logger.info(`Handling user app request for: ${hostname}${pathname}`);

	// Check if this is an agent browser file serving request
	// Pattern: b-{agentid}-{token}.{previewDomain}
	const subdomain = hostname.split('.')[0];
	if (subdomain.startsWith('b-')) {
		// Extract agentId and token from subdomain
		const withoutPrefix = subdomain.substring(2); // Remove 'b-'
		const lastHyphenIndex = withoutPrefix.lastIndexOf('-');

		if (lastHyphenIndex !== -1) {
			const agentId = withoutPrefix.substring(0, lastHyphenIndex);
			logger.info(`Agent browser file serving request for agent: ${agentId}`);

			try {
				const agentStub = await getAgentStub(env, agentId);
				return await agentStub.handleBrowserFileServing(request);
			} catch (error: any) {
				logger.error(`Error forwarding to agent: ${error.message}`);
				return new Response('Agent not found', { status: 404 });
			}
		}
	}

	// For API routes on preview subdomains, try sandbox first, but if it fails with 500,
	// the backend in the sandbox might not be running or the route might not exist.
	// We'll let the sandbox handle it and return the error, as the app's backend should be in the sandbox.
	//
	// NOTE: trycloudflare.com tunnel URLs bypass the worker entirely and go directly to the sandbox
	// via cloudflared tunnel. For those URLs, errors come directly from the sandbox container's
	// dev server. This function only handles requests that go through the worker (subdomain patterns
	// or when tunnel URLs are intercepted). For tunnel URLs, the sandbox container's dev server
	// must properly handle API routes.
	
	// 1. Attempt to proxy to a live development sandbox.
	// proxyToSandbox doesn't consume the request body on a miss, so no clone is needed here.
	const sandboxResponse = await proxyToSandbox(request, env);
	if (sandboxResponse) {
		logger.info(`Serving response from sandbox for: ${hostname}${pathname}, status: ${sandboxResponse.status}`);
        // If it was a websocket upgrade, we need to return the response as is
        if (sandboxResponse.headers.get('Upgrade')?.toLowerCase() === 'websocket') {
            logger.info(`Serving websocket response from sandbox for: ${hostname}`);
            return sandboxResponse;
        }
		
		// Add headers to identify this as a sandbox response
		let headers = new Headers(sandboxResponse.headers);
		
        if (sandboxResponse.status >= 500) {
            headers.set('X-Preview-Type', 'sandbox-error');
            // Enhanced error logging for API routes
            if (pathname.startsWith('/api/')) {
                try {
                    const errorText = await sandboxResponse.clone().text();
                    logger.error(`Sandbox API 500 error for ${hostname}${pathname}`, {
                        status: sandboxResponse.status,
                        errorPreview: errorText.substring(0, 1000),
                        method: request.method,
                        isTunnelUrl: hostname.includes('trycloudflare.com'),
                    });
                    
                    // Provide more specific error context
                    if (errorText.includes('404') || errorText.includes('Not Found') || errorText.length === 0) {
                        logger.warn(`API route ${pathname} not found in sandbox. The generated app's backend may not be running or the route doesn't exist. Generated apps with backend APIs need their backend server to be running in the sandbox.`);
                    } else if (errorText.includes('ECONNREFUSED') || errorText.includes('Connection refused')) {
                        logger.error(`API route ${pathname} - Connection refused. The backend server in the sandbox may not be running on the expected port.`);
                    } else if (errorText.includes('timeout') || errorText.includes('Timeout')) {
                        logger.error(`API route ${pathname} - Request timeout. The backend server in the sandbox may be unresponsive.`);
                    }
                } catch (e) {
                    logger.error(`Sandbox returned ${sandboxResponse.status} for ${hostname}${pathname}, but couldn't read error body`, {
                        error: e instanceof Error ? e.message : String(e),
                        method: request.method,
                        isTunnelUrl: hostname.includes('trycloudflare.com'),
                    });
                }
            } else {
                // Log non-API 500 errors too
                try {
                    const errorText = await sandboxResponse.clone().text();
                    logger.error(`Sandbox returned ${sandboxResponse.status} for ${hostname}${pathname}`, {
                        errorPreview: errorText.substring(0, 500),
                        method: request.method,
                    });
                } catch (e) {
                    logger.error(`Sandbox returned ${sandboxResponse.status} for ${hostname}${pathname}, but couldn't read error body`, {
                        error: e instanceof Error ? e.message : String(e),
                    });
                }
            }
        } else {
            headers.set('X-Preview-Type', 'sandbox');
        }
        
        // Apply preview security headers (allows iframe embedding)
        const previewSecurityConfig = getPreviewSecurityHeaders(env);
        const previewSecurityHeaders = buildSecurityHeaders(previewSecurityConfig);
        for (const [key, value] of previewSecurityHeaders.entries()) {
            headers.set(key, value);
        }
        
        headers = setOriginControl(env, request, headers);
        headers.append('Vary', 'Origin');
		headers.set('Access-Control-Expose-Headers', 'X-Preview-Type');
		
		return new Response(sandboxResponse.body, {
			status: sandboxResponse.status,
			statusText: sandboxResponse.statusText,
			headers,
		});
	}

	// 2. If sandbox misses, attempt to dispatch to a deployed worker.
	logger.info(`Sandbox miss for ${hostname}, attempting dispatch to permanent worker.`);
	if (!isDispatcherAvailable(env)) {
		logger.warn(`Dispatcher not available, cannot serve: ${hostname}`);
		return new Response('This application is not currently available. The sandbox instance may not be running or the app has not been deployed yet.', { 
			status: 404,
			headers: {
				'Content-Type': 'text/plain',
				'X-Preview-Type': 'not-found'
			}
		});
	}

	// Extract the app name (e.g., "xyz" from "xyz.build.cloudflare.dev").
	const appName = subdomain;
	const dispatcher = env['DISPATCHER'];

	try {
		const worker = dispatcher.get(appName);
		const dispatcherResponse = await worker.fetch(request);

		// Add headers to identify this as a dispatcher response
		let headers = new Headers(dispatcherResponse.headers);

		headers.set('X-Preview-Type', 'dispatcher');
		
		// Apply preview security headers (allows iframe embedding)
		const previewSecurityConfig = getPreviewSecurityHeaders(env);
		const previewSecurityHeaders = buildSecurityHeaders(previewSecurityConfig);
		for (const [key, value] of previewSecurityHeaders.entries()) {
			headers.set(key, value);
		}
		
        headers = setOriginControl(env, request, headers);
        headers.append('Vary', 'Origin');
		headers.set('Access-Control-Expose-Headers', 'X-Preview-Type');

		return new Response(dispatcherResponse.body, {
			status: dispatcherResponse.status,
			statusText: dispatcherResponse.statusText,
			headers,
		});
	} catch (error: any) {
		// This block catches errors if the binding doesn't exist or if worker.fetch() fails.
		logger.warn(`Error dispatching to worker '${appName}': ${error.message}`);

		// Provide more helpful error message
		let errorMessage: string;
		if (error.message?.includes('not found') || error.message?.includes('does not exist')) {
			errorMessage = `Application '${appName}' has not been deployed yet. Please deploy the app first.`;
		} else if (hostname.includes('.localhost')) {
			// For localhost preview URLs, the issue is likely that exposePort() format doesn't match routing
			errorMessage = `Preview URL format not supported for local development. The sandbox instance may not be running, or the preview URL format from exposePort() doesn't match the expected routing pattern. If a tunnel URL is available, use that instead.`;
		} else {
			errorMessage = `An error occurred while loading this application: ${error.message || 'Unknown error'}`;
		}

		return new Response(errorMessage, { 
			status: 500,
			headers: {
				'Content-Type': 'text/plain',
				'X-Preview-Type': 'dispatcher-error'
			}
		});
	}
}

/**
 * Main Worker fetch handler with robust, secure routing.
 */
const worker = {
	async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
        // logger.info(`Received request: ${request.method} ${request.url}`);
		// --- Pre-flight Checks ---

		// 1. Critical configuration check: Ensure custom domain is set.
        const previewDomain = getPreviewDomain(env);
		if (!previewDomain || previewDomain.trim() === '') {
			logger.error('FATAL: env.CUSTOM_DOMAIN is not configured in wrangler.toml or the Cloudflare dashboard.');
			return new Response('Server configuration error: Application domain is not set.', { status: 500 });
		}

		const url = new URL(request.url);
		const { hostname, pathname } = url;

		// 2. Security: Immediately reject any requests made via an IP address.
		const ipRegex = /^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}$/;
		if (ipRegex.test(hostname)) {
			return new Response('Access denied. Please use the assigned domain name.', { status: 403 });
		}

		// --- Domain-based Routing ---

		// Normalize hostnames for both local development (localhost) and production.
		// Remove protocol from CUSTOM_DOMAIN if present for comparison
		const customDomain = env.CUSTOM_DOMAIN.replace(/^https?:\/\//, '').replace(/\/$/, '');
		const isMainDomainRequest =
			hostname === customDomain || hostname === 'localhost';
		const isSubdomainRequest =
			hostname.endsWith(`.${previewDomain}`) ||
			(hostname.endsWith('.localhost') && hostname !== 'localhost');
		
		// Check if this is a trycloudflare.com tunnel URL
		// These URLs go directly to sandbox via tunnel, but we should still try to proxy through worker
		// for better error handling and logging
		const isTunnelUrl = hostname.includes('trycloudflare.com');

		// Route 1: Main Platform Request (e.g., build.cloudflare.dev or localhost)
		if (isMainDomainRequest) {
			// Handle Git protocol endpoints directly
			// Route: /apps/:id.git/info/refs or /apps/:id.git/git-upload-pack
			if (isGitProtocolRequest(pathname)) {
				return handleGitProtocolRequest(request, env, ctx);
			}

			// Serve static assets for all non-API routes from the ASSETS binding.
			if (!pathname.startsWith('/api/')) {
				return env.ASSETS.fetch(request);
			}
			// AI Gateway proxy for generated apps
			if (pathname.startsWith('/api/proxy/openai')) {
                // Only handle requests from valid origins of the preview domain
                const origin = request.headers.get('Origin');
                const previewDomain = getPreviewDomain(env);

                logger.info(`Origin: ${origin}, Preview Domain: ${previewDomain}`);

                return proxyToAiGateway(request, env, ctx);
				// if (origin && origin.endsWith(`.${previewDomain}`)) {
                //     return proxyToAiGateway(request, env, ctx);
                // }
                // logger.warn(`Access denied. Invalid origin: ${origin}, preview domain: ${previewDomain}`);
                // return new Response('Access denied. Invalid origin.', { status: 403 });
			}

			// Handle all API requests with the main Hono application.
			logger.info(`Handling API request for: ${url}`);
			const app = createApp(env);
			return app.fetch(request, env, ctx);
		}

		// Route 2: User App Request (e.g., xyz.build.cloudflare.dev or test.localhost)
		// Also handle trycloudflare.com tunnel URLs - these should proxy to sandbox
		if (isSubdomainRequest || isTunnelUrl) {
			return handleUserAppRequest(request, env);
		}

		return new Response('Not Found', { status: 404 });
	},
} satisfies ExportedHandler<Env>;

export default worker;

// Wrap the entire worker with Sentry for comprehensive error monitoring.
// export default Sentry.withSentry(sentryOptions, worker);
