/**
 * Centralized Security Configuration
 * Provides comprehensive security settings for Hono middleware
 */

import { DEFAULT_RATE_LIMIT_SETTINGS, RateLimitSettings } from "../services/rate-limit/config";
import { Context } from "hono";
import { isDev } from "../utils/envs";

// Type definitions for security configurations
export interface CORSConfig {
    origin: string | string[] | ((origin: string, c: Context) => string | undefined | null);
    allowMethods?: string[];
    allowHeaders?: string[];
    maxAge?: number;
    credentials?: boolean;
    exposeHeaders?: string[];
}

export interface CSRFConfig {
    origin: string | string[] | ((origin: string, c: Context) => boolean);
    tokenTTL: number; // Token Time-To-Live in milliseconds
    rotateOnAuth: boolean; // Rotate token on authentication state changes
    cookieName: string;
    headerName: string;
}

// These settings can be altered dynamically via e.g, admin panel
export interface ConfigurableSecuritySettings {
    rateLimit: RateLimitSettings;
}

export function getConfigurableSecurityDefaults(): ConfigurableSecuritySettings {
    return {
        rateLimit: DEFAULT_RATE_LIMIT_SETTINGS,
    };
}

/**
 * Get allowed origins based on environment
 */
export function getAllowedOrigins(env: Env): string[] {
    const origins: string[] = [];
    
    // Production domains - handle both custom domains and workers.dev
    if (env.CUSTOM_DOMAIN) {
        // Remove protocol if present
        const domain = env.CUSTOM_DOMAIN.replace(/^https?:\/\//, '').replace(/\/$/, '');
        // Always use https for workers.dev and custom domains (not localhost)
        if (domain.includes('localhost') || domain.includes('127.0.0.1')) {
            origins.push(`http://${domain}`);
        } else {
            origins.push(`https://${domain}`);
        }
    }
    
    // Additional allowed origins from environment variable (comma-separated)
    // Format: "https://domain1.com,https://domain2.com,http://localhost:3000"
    if (env.ALLOWED_ORIGINS) {
        const additionalOrigins = env.ALLOWED_ORIGINS.split(',')
            .map((origin: string) => origin.trim())
            .filter((origin: string) => origin.length > 0);
        origins.push(...additionalOrigins);
    }
    
    // Development origins (only in development)
    if (isDev(env)) {
        origins.push('http://localhost:3000');
        origins.push('http://localhost:5173');
        origins.push('http://localhost:8787');
        origins.push('http://127.0.0.1:3000');
        origins.push('http://127.0.0.1:5173');
        origins.push('http://127.0.0.1:8787');
    }
    
    // Allow preview subdomain patterns and tunnel URLs
    // This allows requests from preview URLs like:
    // - port-sandboxId-token.domain (pattern URLs)
    // - *.trycloudflare.com (tunnel URLs)
    // - *.build-preview.cloudflare.dev (Cloudflare preview URLs)
    origins.push('https://*.trycloudflare.com');
    origins.push('http://*.trycloudflare.com');
    origins.push('https://*.build-preview.cloudflare.dev');
    origins.push('http://*.build-preview.cloudflare.dev');
    
    // Allow any subdomain of the main domain for preview URLs
    if (env.CUSTOM_DOMAIN) {
        const domain = env.CUSTOM_DOMAIN.replace(/^https?:\/\//, '').replace(/\/$/, '');
        if (!domain.includes('localhost') && !domain.includes('127.0.0.1')) {
            // Allow any subdomain pattern (for port-sandboxId-token.domain)
            origins.push(`https://*.${domain}`);
        } else {
            // For localhost, allow subdomain patterns with http
            origins.push(`http://*.${domain}`);
        }
    }
    
    return origins;
}

export function isOriginAllowed(env: Env, origin: string): boolean {
    const allowedOrigins = getAllowedOrigins(env);
    if (!origin) return false;
    
    // Check exact match first
    if (allowedOrigins.includes(origin)) {
        return true;
    }
    
    // Check wildcard patterns
    for (const allowedOrigin of allowedOrigins) {
        if (allowedOrigin.includes('*')) {
            // Convert wildcard pattern to regex
            // e.g., "https://*.trycloudflare.com" -> /^https:\/\/[^/]+\.trycloudflare\.com$/
            const pattern = allowedOrigin
                .replace(/[.+?^${}()|[\]\\]/g, '\\$&') // Escape special regex chars
                .replace(/\*/g, '[^/]+'); // Replace * with non-slash chars
            const regex = new RegExp(`^${pattern}$`);
            if (regex.test(origin)) {
                return true;
            }
        }
    }
    
    // Check if origin is a subdomain of the main domain
    if (env.CUSTOM_DOMAIN) {
        const domain = env.CUSTOM_DOMAIN.replace(/^https?:\/\//, '').replace(/\/$/, '');
        if (origin.includes(`.${domain}`) || origin.endsWith(domain)) {
            return true;
        }
    }
    
    return false;
}

/**
 * CORS Configuration
 * Strict origin validation with environment-aware settings
 */
export function getCORSConfig(env: Env): CORSConfig {
    return {
        origin: (origin: string) => {
            // Allow same-origin requests (no origin header means same-origin)
            if (!origin) {
                return origin;
            }
            
            // Check if origin is allowed
            if (isOriginAllowed(env, origin)) {
                return origin;
            }
            
            // For preview URLs (tunnel URLs and subdomain patterns), allow them
            // This handles cases where the preview URL is making API calls to itself
            if (origin.includes('trycloudflare.com') || 
                origin.includes('build-preview.cloudflare.dev') ||
                origin.match(/^\d{4,5}-[^.]+\.[^.]+\.[^.]+$/)) { // port-sandboxId-token pattern
                return origin;
            }
            
            return null;
        },
        allowMethods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'PATCH'],
        allowHeaders: [
            'Content-Type',
            'Authorization',
            'X-Request-ID',
            'X-Session-Token',
            'X-CSRF-Token'
        ],
        exposeHeaders: [
            'X-Request-ID',
            'X-RateLimit-Limit',
            'X-RateLimit-Remaining',
            'X-RateLimit-Reset'
        ],
        maxAge: 86400, // 24 hours
        credentials: true
    };
}

/**
 * CSRF Protection Configuration
 * Double-submit cookie pattern with origin validation
 */
export function getCSRFConfig(env: Env): CSRFConfig {
    return {
        origin: (origin: string) => isOriginAllowed(env, origin),
        tokenTTL: 2 * 60 * 60 * 1000, // 2 hours
        rotateOnAuth: true,
        cookieName: 'csrf-token',
        headerName: 'X-CSRF-Token'
    };
}

// Type for CSP directives
interface ContentSecurityPolicyConfig {
    defaultSrc?: string[];
    scriptSrc?: string[];
    styleSrc?: string[];
    fontSrc?: string[];
    imgSrc?: string[];
    connectSrc?: string[];
    frameSrc?: string[];
    objectSrc?: string[];
    mediaSrc?: string[];
    workerSrc?: string[];
    formAction?: string[];
    frameAncestors?: string[];
    baseUri?: string[];
    manifestSrc?: string[];
    upgradeInsecureRequests?: string[];
}

// Type for secure headers configuration
interface SecureHeadersConfig {
    contentSecurityPolicy?: ContentSecurityPolicyConfig;
    strictTransportSecurity?: string;
    xFrameOptions?: string | false;
    xContentTypeOptions?: string;
    xXssProtection?: string | false;
    referrerPolicy?: string;
    crossOriginEmbedderPolicy?: string | false;
    crossOriginResourcePolicy?: string | false;
    crossOriginOpenerPolicy?: string | false;
    originAgentCluster?: string;
    xDnsPrefetchControl?: string;
    xDownloadOptions?: string;
    xPermittedCrossDomainPolicies?: string;
    permissionsPolicy?: Record<string, string[]>;
}

/**
 * Get allowed frame ancestors for iframe embedding
 */
function getAllowedFrameAncestors(env: Env): string[] {
    const frameAncestors: string[] = ["'self'"];
    
    // Add allowed origins as frame ancestors for iframe embedding
    const allowedOrigins = getAllowedOrigins(env);
    for (const origin of allowedOrigins) {
        // Skip wildcard patterns (but allow them to be processed for subdomain matching)
        if (origin.includes('*')) {
            // For wildcard patterns like "https://*.domain.com", we can't use them directly in CSP
            // But we should extract the base domain if possible
            continue;
        }
        
        // Include all non-wildcard origins (including localhost in dev)
        if (origin.includes('localhost') || origin.includes('127.0.0.1')) {
            if (isDev(env)) {
                frameAncestors.push(origin);
            }
        } else {
            // Production origins (like learning-beta.earlywave.in)
            frameAncestors.push(origin);
        }
    }
    
    return frameAncestors;
}

/**
 * Build security headers from config (for manual header setting)
 */
export function buildSecurityHeaders(config: SecureHeadersConfig): Headers {
    const headers = new Headers();
    
    // Build CSP header
    if (config.contentSecurityPolicy) {
        const csp = config.contentSecurityPolicy;
        const cspParts: string[] = [];
        
        if (csp.defaultSrc) cspParts.push(`default-src ${csp.defaultSrc.join(' ')}`);
        if (csp.scriptSrc) cspParts.push(`script-src ${csp.scriptSrc.join(' ')}`);
        if (csp.styleSrc) cspParts.push(`style-src ${csp.styleSrc.join(' ')}`);
        if (csp.fontSrc) cspParts.push(`font-src ${csp.fontSrc.join(' ')}`);
        if (csp.imgSrc) cspParts.push(`img-src ${csp.imgSrc.join(' ')}`);
        if (csp.connectSrc) cspParts.push(`connect-src ${csp.connectSrc.join(' ')}`);
        if (csp.frameSrc) cspParts.push(`frame-src ${csp.frameSrc.join(' ')}`);
        if (csp.objectSrc) cspParts.push(`object-src ${csp.objectSrc.join(' ')}`);
        if (csp.mediaSrc) cspParts.push(`media-src ${csp.mediaSrc.join(' ')}`);
        if (csp.workerSrc) cspParts.push(`worker-src ${csp.workerSrc.join(' ')}`);
        if (csp.formAction) cspParts.push(`form-action ${csp.formAction.join(' ')}`);
        if (csp.frameAncestors) cspParts.push(`frame-ancestors ${csp.frameAncestors.join(' ')}`);
        if (csp.baseUri) cspParts.push(`base-uri ${csp.baseUri.join(' ')}`);
        if (csp.manifestSrc) cspParts.push(`manifest-src ${csp.manifestSrc.join(' ')}`);
        if (csp.upgradeInsecureRequests !== undefined && csp.upgradeInsecureRequests.length === 0) {
            cspParts.push('upgrade-insecure-requests');
        }
        
        if (cspParts.length > 0) {
            headers.set('Content-Security-Policy', cspParts.join('; '));
        }
    }
    
    // Set other security headers
    if (config.strictTransportSecurity) {
        headers.set('Strict-Transport-Security', config.strictTransportSecurity);
    }
    if (config.xFrameOptions !== false) {
        headers.set('X-Frame-Options', config.xFrameOptions || 'DENY');
    }
    if (config.xContentTypeOptions) {
        headers.set('X-Content-Type-Options', config.xContentTypeOptions);
    }
    if (config.xXssProtection !== false) {
        headers.set('X-XSS-Protection', config.xXssProtection || '1; mode=block');
    }
    if (config.referrerPolicy) {
        headers.set('Referrer-Policy', config.referrerPolicy);
    }
    if (config.crossOriginEmbedderPolicy !== false) {
        headers.set('Cross-Origin-Embedder-Policy', config.crossOriginEmbedderPolicy || 'require-corp');
    }
    if (config.crossOriginResourcePolicy) {
        headers.set('Cross-Origin-Resource-Policy', config.crossOriginResourcePolicy);
    }
    if (config.crossOriginOpenerPolicy) {
        headers.set('Cross-Origin-Opener-Policy', config.crossOriginOpenerPolicy);
    }
    if (config.originAgentCluster) {
        headers.set('Origin-Agent-Cluster', config.originAgentCluster);
    }
    if (config.xDnsPrefetchControl) {
        headers.set('X-DNS-Prefetch-Control', config.xDnsPrefetchControl);
    }
    if (config.xDownloadOptions) {
        headers.set('X-Download-Options', config.xDownloadOptions);
    }
    if (config.xPermittedCrossDomainPolicies) {
        headers.set('X-Permitted-Cross-Domain-Policies', config.xPermittedCrossDomainPolicies);
    }
    if (config.permissionsPolicy) {
        const ppParts = Object.entries(config.permissionsPolicy).map(([key, value]) => {
            return `${key}=${value.length > 0 ? `(${value.join(' ')})` : '()'}`;
        });
        headers.set('Permissions-Policy', ppParts.join(', '));
    }
    
    return headers;
}

/**
 * Get relaxed security headers for preview responses (sandbox/dispatcher)
 * These headers allow iframe embedding while maintaining security
 */
export function getPreviewSecurityHeaders(env: Env): SecureHeadersConfig {
    const isDevelopment = isDev(env);
    const allowedFrameAncestors = getAllowedFrameAncestors(env);
    const previewDomain = env.CUSTOM_DOMAIN?.replace(/^https?:\/\//, '').replace(/\/$/, '') || '';
    
    return {
        contentSecurityPolicy: {
            defaultSrc: ["'self'"],
            scriptSrc: [
                "'self'",
                "'strict-dynamic'",
                ...(isDevelopment ? ["'unsafe-eval'"] : [])
            ],
            styleSrc: [
                "'self'",
                "'unsafe-inline'", // Required for Tailwind CSS and generated apps
                "https://fonts.googleapis.com"
            ],
            fontSrc: [
                "'self'",
                "https://fonts.gstatic.com",
                "data:"
            ],
            imgSrc: [
                "'self'",
                "data:",
                "blob:",
                "https://avatars.githubusercontent.com",
                "https://lh3.googleusercontent.com",
                "https://*.cloudflare.com"
            ],
            connectSrc: [
                "'self'",
                "https://api.github.com",
                "https://api.cloudflare.com",
                // Allow preview subdomains to connect to main domain and each other
                ...(previewDomain ? [
                    `https://*.${previewDomain}`,
                    `https://${previewDomain}`,
                    `wss://*.${previewDomain}`,
                    `wss://${previewDomain}`
                ] : []),
                "wss://*", // Allow WebSocket connections
                "ws://*",
            ],
            frameSrc: [
                "'self'",
                // Allow preview subdomains to be embedded
                ...(previewDomain ? [`https://*.${previewDomain}`] : []),
                "https://*.trycloudflare.com",
                "http://*.trycloudflare.com",
            ],
            objectSrc: ["'none'"],
            mediaSrc: ["'self'"],
            workerSrc: ["'self'", "blob:"],
            formAction: ["'self'"],
            // Allow framing from allowed origins (for iframe embedding)
            frameAncestors: allowedFrameAncestors.length > 1 ? allowedFrameAncestors : ["'self'"],
            baseUri: ["'self'"],
            manifestSrc: ["'self'"],
        },
        // Relaxed X-Frame-Options for previews
        xFrameOptions: allowedFrameAncestors.length > 1 ? false : 'SAMEORIGIN', // Let CSP handle it
        xContentTypeOptions: 'nosniff',
        xXssProtection: false, // Let CSP handle it
        referrerPolicy: 'strict-origin-when-cross-origin',
        crossOriginEmbedderPolicy: false,
        crossOriginResourcePolicy: 'cross-origin',
        crossOriginOpenerPolicy: 'same-origin-allow-popups',
    };
}

/**
 * Secure Headers Configuration
 * Comprehensive security headers with CSP
 */
export function getSecureHeadersConfig(env: Env): SecureHeadersConfig {
    const isDevelopment = isDev(env);
    const allowedFrameAncestors = getAllowedFrameAncestors(env);
    
    return {
        // Content Security Policy - strict by default
        contentSecurityPolicy: {
            defaultSrc: ["'self'"],
            scriptSrc: [
                "'self'",
                // Allow inline scripts with nonce (Hono will add nonce automatically)
                "'strict-dynamic'",
                // Development only - for hot reload
                ...(isDevelopment ? ["'unsafe-eval'"] : [])
            ],
            styleSrc: [
                "'self'",
                "'unsafe-inline'", // Required for Tailwind CSS
                "https://fonts.googleapis.com"
            ],
            fontSrc: [
                "'self'",
                "https://fonts.gstatic.com",
                "data:"
            ],
            imgSrc: [
                "'self'",
                "data:",
                "blob:",
                "https://avatars.githubusercontent.com", // GitHub avatars
                "https://lh3.googleusercontent.com", // Google avatars
                "https://*.cloudflare.com" // Cloudflare assets
            ],
            connectSrc: [
                "'self'",
                "https://api.github.com",
                "https://api.cloudflare.com",
                // Allow preview subdomains to connect to main domain
                ...(env.CUSTOM_DOMAIN ? [`https://*.${env.CUSTOM_DOMAIN.replace(/^https?:\/\//, '').replace(/\/$/, '')}`] : []),
                "wss://*", // Allow WebSocket connections for previews
                "ws://*",
            ],
            frameSrc: [
                "'self'",
                // Allow preview subdomains to be embedded
                ...(env.CUSTOM_DOMAIN ? [`https://*.${env.CUSTOM_DOMAIN.replace(/^https?:\/\//, '').replace(/\/$/, '')}`] : []),
                "https://*.trycloudflare.com",
                "http://*.trycloudflare.com",
            ],
            objectSrc: ["'none'"],
            mediaSrc: ["'self'"],
            workerSrc: ["'self'", "blob:"],
            formAction: ["'self'"],
            // Allow framing from allowed origins (for iframe embedding)
            frameAncestors: allowedFrameAncestors.length > 1 ? allowedFrameAncestors : ["'self'"],
            baseUri: ["'self'"],
            manifestSrc: ["'self'"],
            upgradeInsecureRequests: !isDevelopment ? [] : undefined
        },
        
        // Strict Transport Security (HSTS)
        strictTransportSecurity: isDevelopment 
            ? undefined // Don't set in development
            : 'max-age=31536000; includeSubDomains; preload',
        
        // X-Frame-Options - Allow framing from allowed origins
        // If we have allowed frame ancestors, use SAMEORIGIN or ALLOW-FROM (legacy)
        // Otherwise use DENY for security
        xFrameOptions: allowedFrameAncestors.length > 1 ? 'SAMEORIGIN' : 'DENY',
        
        // X-Content-Type-Options - Prevent MIME sniffing
        xContentTypeOptions: 'nosniff',
        
        // X-XSS-Protection - Legacy XSS protection
        xXssProtection: '1; mode=block',
        
        // Referrer Policy - Privacy-focused
        referrerPolicy: 'strict-origin-when-cross-origin',
        
        // Cross-Origin policies - Relaxed for iframe contexts
        // When embedding in iframes, we need to allow cross-origin resources
        crossOriginEmbedderPolicy: false, // Disable COEP for iframe compatibility
        crossOriginResourcePolicy: 'cross-origin', // Allow cross-origin resources
        crossOriginOpenerPolicy: 'same-origin-allow-popups', // Relaxed for iframe communication
        
        // Origin Agent Cluster
        originAgentCluster: '?1',
        
        // X-DNS-Prefetch-Control
        xDnsPrefetchControl: 'off',
        
        // X-Download-Options - IE specific
        xDownloadOptions: 'noopen',
        
        // X-Permitted-Cross-Domain-Policies
        xPermittedCrossDomainPolicies: 'none',
        
        // Permissions Policy - Feature restrictions
        permissionsPolicy: {
            camera: [],
            microphone: [],
            geolocation: [],
            usb: [],
            payment: [],
            magnetometer: [],
            gyroscope: [],
            accelerometer: [],
            autoplay: ['self'],
            fullscreen: ['self'],
            clipboard: ['self']
        }
    };
}