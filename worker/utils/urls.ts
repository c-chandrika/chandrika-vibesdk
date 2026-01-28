export const getProtocolForHost = (host: string): string => {
    if (host.startsWith('localhost') || host.startsWith('127.0.0.1') || host.startsWith('0.0.0.0') || host.startsWith('::1')) {
        return 'http';
    } else {
        return 'https';
    }
}
export function getPreviewDomain(env: Env): string {
    if (env.CUSTOM_PREVIEW_DOMAIN && env.CUSTOM_PREVIEW_DOMAIN.trim() !== '') {
        // Remove protocol if present (domain only)
        return env.CUSTOM_PREVIEW_DOMAIN.replace(/^https?:\/\//, '').replace(/\/$/, '');
    }
    // For local dev, if CUSTOM_DOMAIN is empty or localhost, use 'localhost' for worker dev
    if (!env.CUSTOM_DOMAIN || env.CUSTOM_DOMAIN.trim() === '' || env.CUSTOM_DOMAIN.includes('localhost')) {
        return 'localhost';
    }
    // Remove protocol if present (domain only)
    return env.CUSTOM_DOMAIN.replace(/^https?:\/\//, '').replace(/\/$/, '');
}

export function buildUserWorkerUrl(env: Env, deploymentId: string): string {
    const domain = getPreviewDomain(env);
    const protocol = getProtocolForHost(domain);
    return `${protocol}://${deploymentId}.${domain}`;
}

/**
 * Migrate a stored preview URL to the current domain.
 * Extracts subdomain from old URL and rebuilds with current getPreviewDomain().
 * Used to handle domain changes without invalidating existing sandbox instances.
 */
export function migratePreviewUrl(storedUrl: string | undefined, env: Env): string | undefined {
    if (!storedUrl) return undefined;

    try {
        const url = new URL(storedUrl);
        const hostname = url.hostname;
        const currentDomain = getPreviewDomain(env);

        // Already using current domain
        if (hostname.endsWith(`.${currentDomain}`)) {
            return storedUrl;
        }

        // Extract subdomain by finding the first dot
        const firstDotIndex = hostname.indexOf('.');
        if (firstDotIndex === -1) return storedUrl;

        const subdomain = hostname.slice(0, firstDotIndex);

        // Rebuild with current domain
        let migratedUrl = `${url.protocol}//${subdomain}.${currentDomain}${url.pathname}`;
        
        // Normalize protocol for localhost (should be http:// not https://)
        if (currentDomain && (currentDomain.includes('localhost') || currentDomain.includes('127.0.0.1'))) {
            migratedUrl = migratedUrl.replace(/^https:\/\//, 'http://');
        }
        
        return migratedUrl;
    } catch {
        return storedUrl;
    }
}

export function buildGitCloneUrl(env: Env, appId: string, token?: string): string {
    const domain = env.CUSTOM_DOMAIN;
    const protocol = getProtocolForHost(domain);
    // Git expects username:password format. Use 'oauth2' as username and token as password
    // This is a standard pattern for token-based git authentication
    const auth = token ? `oauth2:${token}@` : '';
    return `${protocol}://${auth}${domain}/apps/${appId}.git`;
}