/**
 * Permission Check Middleware
 * Validates user permissions for protected routes
 */

const { hasPermission, hasWildcard } = require('../html/utils/permissions');
const { getUserByUsername } = require('../routes/users');
const { logger, securityLogger } = require('../html/utils/logger');
const config = require('../html/utils/config');

/**
 * Middleware factory for permission checking
 * @param {string|string[]} requiredPermissions - Permission(s) required to access the route
 * @returns {Function} Express middleware function
 */
function requirePermission(requiredPermissions) {
    // Ensure requiredPermissions is an array
    const permissions = Array.isArray(requiredPermissions) 
        ? requiredPermissions 
        : [requiredPermissions];

    return async (req, res, next) => {
        try {
            // Check if user is authenticated
            if (!req.session || !req.session.userId || !req.session.username) {
                securityLogger.warn('Unauthorized access attempt - no session', {
                    ip: req.ip,
                    path: req.path
                });
                return res.status(401).json({
                    success: false,
                    error: 'Nicht authentifiziert. Bitte melden Sie sich an.'
                });
            }

            // Force disable permissions if configured
            if (config.forceDisablePermissions) {
                securityLogger.warn('Permissions system DISABLED via FORCE_DISABLE_PERMISSIONS', {
                    username: req.session.username,
                    path: req.path
                });
                return next();
            }

            // Get user data with permissions
            const user = await getUserByUsername(req.session.username);
            
            if (!user) {
                securityLogger.warn('Unauthorized access attempt - user not found', {
                    ip: req.ip,
                    username: req.session.username,
                    path: req.path
                });
                return res.status(401).json({
                    success: false,
                    error: 'Benutzer nicht gefunden.'
                });
            }

            // Check if user has wildcard permission
            // Wildcard (*) grants access to everything
            if (hasWildcard(user)) {
                securityLogger.info('Access granted via wildcard permission', {
                    username: req.session.username,
                    path: req.path,
                    requiredPermissions: permissions
                });
                return next();
            }

            // Check if user has any of the required permissions
            let hasAccess = false;
            for (const permission of permissions) {
                if (await hasPermission(user, permission)) {
                    hasAccess = true;
                    break;
                }
            }

            if (hasAccess) {
                return next();
            }

            // Access denied
            securityLogger.warn('Permission denied', {
                ip: req.ip,
                username: req.session.username,
                path: req.path,
                requiredPermissions: permissions,
                userPermissions: user.permissions || [],
                userRoles: user.roles || []
            });

            return res.status(403).json({
                success: false,
                error: 'Keine Berechtigung für diese Aktion.'
            });

        } catch (error) {
            logger.error('Error in permission check middleware:', { 
                error: error.message,
                stack: error.stack 
            });
            return res.status(500).json({
                success: false,
                error: 'Ein Fehler ist aufgetreten.'
            });
        }
    };
}

/**
 * Middleware to check if user is authenticated (no specific permission required)
 */
function requireAuth(req, res, next) {
    if (!req.session || !req.session.userId) {
        return res.status(401).json({
            success: false,
            error: 'Nicht authentifiziert. Bitte melden Sie sich an.'
        });
    }
    next();
}

module.exports = {
    requirePermission,
    requireAuth
};
