/**
 * Session validation middleware
 * Handles session timeout and restart token validation
 */

const config = require('../html/utils/config');
const { logger, securityLogger } = require('../html/utils/logger');

// Server restart token - generated on server start
const RESTART_TOKEN = generateRestartToken();

/**
 * Generates a unique restart token
 * @returns {string} Restart token
 */
function generateRestartToken() {
    const crypto = require('crypto');
    return `restart_${Date.now()}_${crypto.randomBytes(16).toString('hex')}`;
}

/**
 * Session validation middleware
 * Checks for inactivity timeout and validates restart token
 */
function sessionValidation(req, res, next) {
    // Skip validation for public routes
    const publicRoutes = ['/api/auth/login', '/api/csrf-token', '/api/recaptcha-config'];
    if (publicRoutes.includes(req.path)) {
        return next();
    }

    // Skip validation for static files
    if (req.path.match(/\.(html|css|js|png|jpg|jpeg|gif|ico|svg)$/)) {
        return next();
    }

    // Check if user is authenticated
    if (!req.session || !req.session.userId) {
        return next(); // Let route handlers deal with unauthenticated requests
    }

    const now = Date.now();

    // Check restart token
    if (req.session.restartToken !== RESTART_TOKEN) {
        logger.info('Session invalid due to server restart', {
            userId: req.session.userId,
            username: req.session.username
        });
        
        // Destroy session
        req.session.destroy((err) => {
            if (err) {
                logger.error('Error destroying session after restart:', { error: err.message });
            }
        });

        return res.status(401).json({
            success: false,
            error: 'Session expired due to server restart',
            reason: 'server_restart'
        });
    }

    // Check for inactivity timeout
    if (req.session.lastActivity) {
        const inactiveTime = now - req.session.lastActivity;
        
        if (inactiveTime > config.sessionTimeout.inactivityTimeout) {
            securityLogger.info('Session expired due to inactivity', {
                userId: req.session.userId,
                username: req.session.username,
                inactiveTime: Math.round(inactiveTime / 1000) + 's'
            });

            // Destroy session
            req.session.destroy((err) => {
                if (err) {
                    logger.error('Error destroying session after timeout:', { error: err.message });
                }
            });

            return res.status(401).json({
                success: false,
                error: 'Session expired due to inactivity',
                reason: 'inactivity_timeout'
            });
        }
    }

    // Update last activity timestamp
    req.session.lastActivity = now;

    next();
}

/**
 * Initializes a session with required properties
 * @param {Object} session - Express session object
 * @param {Object} user - User object
 */
function initializeSession(session, user) {
    session.userId = user.id || user.username;
    session.username = user.username;
    session.role = user.role;
    session.loginTime = Date.now();
    session.lastActivity = Date.now();
    session.restartToken = RESTART_TOKEN;
}

/**
 * Gets the current restart token
 * @returns {string} Restart token
 */
function getRestartToken() {
    return RESTART_TOKEN;
}

module.exports = {
    sessionValidation,
    initializeSession,
    getRestartToken
};
