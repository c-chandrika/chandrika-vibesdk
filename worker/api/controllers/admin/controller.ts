/**
 * Admin Controller
 * Administrative endpoints for system management
 */

import { BaseController } from '../baseController';
import { createLogger } from '../../../logger';
import { RateLimitType } from '../../../services/rate-limit/config';
import type { RouteContext } from '../../types/route-context';
import { AuthService } from '../../../database/services/AuthService';

// Env is a global type from Cloudflare namespace
type Env = Cloudflare.Env;

const logger = createLogger('AdminController');

export class AdminController extends BaseController {
    static logger = logger;

    /**
     * Reset rate limit for a specific user
     * POST /api/admin/rate-limits/reset
     * Body: { userId?: string, limitType?: 'appCreation' | 'llmCalls' }
     */
    static async resetRateLimit(
        request: Request,
        env: Env,
        _ctx: ExecutionContext,
        routeContext: RouteContext
    ): Promise<Response> {
        try {
            const user = routeContext.user;
            if (!user) {
                return AdminController.createErrorResponse('Unauthorized', 401);
            }

            const bodyResult = await AdminController.parseJsonBody<{
                userId?: string;
                limitType?: 'appCreation' | 'llmCalls';
            }>(request);

            if (!bodyResult.success) {
                return bodyResult.response!;
            }

            const { userId, limitType } = bodyResult.data || {};
            const targetUserId = userId || user.id;

            // Get user to build identifier
            const authService = new AuthService(env);
            const targetUser = await authService.getUserForAuth(targetUserId);
            if (!targetUser) {
                return AdminController.createErrorResponse('User not found', 404);
            }

            // Build identifier (same logic as RateLimitService)
            const identifier = `user:${targetUser.id}`;
            
            // Determine which rate limit type to reset
            const resetType = limitType === 'llmCalls' 
                ? RateLimitType.LLM_CALLS 
                : RateLimitType.APP_CREATION;

            // Build the rate limit key (format: "platform:{type}:{identifier}")
            const key = `platform:${resetType}:${identifier}`;

            // Get the Durable Object stub and reset
            const stub = env.DORateLimitStore.getByName(key);
            await stub.resetLimit(key);

            logger.info('Rate limit reset', { targetUserId, limitType: resetType, key });

            return AdminController.createSuccessResponse({
                success: true,
                message: `Rate limit reset for user ${targetUserId}`,
                limitType: resetType,
            });
        } catch (error) {
            logger.error('Error resetting rate limit', error);
            return AdminController.createErrorResponse(
                error instanceof Error ? error.message : 'Failed to reset rate limit',
                500
            );
        }
    }
}
