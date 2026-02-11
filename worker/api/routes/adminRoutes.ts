/**
 * Admin Routes
 */

import { AdminController } from '../controllers/admin/controller';
import { Hono } from 'hono';
import { AppEnv } from '../../types/appenv';
import { adaptController } from '../honoAdapter';
import { AuthConfig, setAuthLevel } from '../../middleware/auth/routeAuth';

/**
 * Setup admin routes
 */
export function setupAdminRoutes(app: Hono<AppEnv>): void {
    const adminRouter = new Hono<AppEnv>();
    
    // Reset rate limit for a user
    adminRouter.post(
        '/rate-limits/reset',
        setAuthLevel(AuthConfig.authenticated),
        adaptController(AdminController, AdminController.resetRateLimit)
    );
    
    // Mount the admin router under /api/admin
    app.route('/api/admin', adminRouter);
}
