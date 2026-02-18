import { isOriginAllowed } from '../../config/security';

export function validateWebSocketOrigin(request: Request, env: Env): boolean {
    const origin = request.headers.get('Origin');
    
    if (!origin) {
        // Server-side SDK clients do not send `Origin`.
        // ownership and authorization is anyways checked in the middlewares already
        const authHeader = request.headers.get('Authorization');
        if (authHeader && authHeader.toLowerCase().startsWith('bearer ')) {
            return true;
        }
        return false;
    }
    
    return isOriginAllowed(env, origin);
}

export function getWebSocketSecurityHeaders(): Record<string, string> {
    return {
        'X-Frame-Options': 'DENY',
        'X-Content-Type-Options': 'nosniff',
        'X-XSS-Protection': '1; mode=block'
    };
}
