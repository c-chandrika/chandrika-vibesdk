import { createRoot } from 'react-dom/client';
import { createBrowserRouter } from 'react-router';
import { RouterProvider } from 'react-router/dom';
import { initSentry } from './utils/sentry';
import { setBearerToken } from './lib/api-client';

import { routes } from './routes.ts';
import './index.css';

// Initialize Sentry before rendering
initSentry();

// Listen for Bearer token from parent window (for iframe integration)
// Parent app sends token via postMessage with format: { type: 'VIBESDK_TOKEN', token: '...' }
if (typeof window !== 'undefined') {
	window.addEventListener('message', (event: MessageEvent) => {
		// Security: Only accept messages from allowed origins in production
		// In development, we'll be more permissive
		const isDev = import.meta.env.DEV;
		const allowedOrigins = [
			'http://localhost:3000',
			'https://learning-beta.earlywave.in',
			'https://learning.ccbp.in',
		];

		// In production, verify origin for security
		if (!isDev && event.origin && !allowedOrigins.includes(event.origin)) {
			console.warn('Ignoring postMessage from unauthorized origin:', event.origin);
			return;
		}

		// Handle token message from parent
		if (event.data && typeof event.data === 'object') {
			if (event.data.type === 'VIBESDK_TOKEN' && event.data.token) {
				setBearerToken(event.data.token);
				console.log('Bearer token received from parent window');
			} else if (event.data.type === 'VIBESDK_TOKEN_CLEAR') {
				setBearerToken(null);
				console.log('Bearer token cleared');
			}
		}
	});
}

// Type for React Router hydration data  
import type { RouterState } from 'react-router';

declare global {
  interface Window {
    __staticRouterHydrationData?: Partial<Pick<RouterState, 'loaderData' | 'actionData' | 'errors'>>;
  }
}

const router = createBrowserRouter(routes, {
	hydrationData: window.__staticRouterHydrationData,
});

createRoot(document.getElementById('root')!).render(
  <RouterProvider router={router} />
);
