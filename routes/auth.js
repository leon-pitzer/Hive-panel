/**
 * Authentication routes
 * Handles login, logout, and auth status endpoints
 */

const express = require('express');
const { body, validationResult } = require('express-validator');
const rateLimit = require('express-rate-limit');
const { verifyRecaptcha } = require('../html/utils/recaptcha');
const { verifyUserPassword } = require('./users');
const { initializeSession } = require('../middleware/sessionValidation');
const loginAttempts = require('../html/utils/loginAttempts');
const { logger, securityLogger } = require('../html/utils/logger');
const config = require('../html/utils/config');

const router = express.Router();

// Rate limiter for login endpoint
const loginLimiter = rateLimit({
    windowMs: config.rateLimit.windowMs,
    max: config.rateLimit.max,
    message: config.rateLimit.message,
    standardHeaders: config.rateLimit.standardHeaders,
    legacyHeaders: config.rateLimit.legacyHeaders,
    skipSuccessfulRequests: config.rateLimit.skipSuccessfulRequests,
    handler: (req, res) => {
        securityLogger.warn('Rate limit exceeded for login', {
            ip: req.ip,
            username: req.body.username
        });
        res.status(429).json({
            success: false,
            error: config.rateLimit.message
        });
    }
});

/**
 * POST /api/auth/login
 * Authenticates a user with username, password, and optional reCAPTCHA
 */
router.post('/login',
    loginLimiter,
    [
        body('username').trim().notEmpty().withMessage('Username is required'),
        body('password').notEmpty().withMessage('Password is required'),
        body('recaptchaToken').optional()
    ],
    async (req, res) => {
        try {
            // Validate input
            const errors = validationResult(req);
            if (!errors.isEmpty()) {
                return res.status(400).json({
                    success: false,
                    error: 'Invalid input',
                    errors: errors.array()
                });
            }

            const { username, password, recaptchaToken } = req.body;
            const clientIp = req.ip;

            // Check if user/IP is locked
            const lockStatus = loginAttempts.isLocked(username);
            if (lockStatus.isLocked) {
                const minutes = Math.ceil(lockStatus.remainingTime / 60000);
                securityLogger.warn('Login attempt while locked', {
                    username,
                    ip: clientIp,
                    remainingTime: minutes + ' minutes'
                });
                return res.status(429).json({
                    success: false,
                    error: `Zu viele Fehlversuche. Bitte versuchen Sie es in ${minutes} Minute${minutes !== 1 ? 'n' : ''} erneut.`
                });
            }

            // Verify reCAPTCHA if enabled
            if (config.recaptcha.enabled) {
                const recaptchaResult = await verifyRecaptcha(recaptchaToken, clientIp);
                if (!recaptchaResult.success) {
                    securityLogger.warn('reCAPTCHA verification failed during login', {
                        username,
                        ip: clientIp
                    });
                    return res.status(400).json({
                        success: false,
                        error: 'reCAPTCHA-Verifizierung fehlgeschlagen. Bitte versuchen Sie es erneut.'
                    });
                }
            }

            // Verify credentials
            const user = await verifyUserPassword(username, password);

            if (user) {
                // Successful login
                loginAttempts.resetAttempts(username);
                
                // Initialize session
                initializeSession(req.session, user);

                securityLogger.info('Successful login', {
                    username,
                    ip: clientIp,
                    role: user.role
                });

                res.json({
                    success: true,
                    message: 'Login erfolgreich',
                    user: {
                        username: user.username,
                        role: user.role
                    }
                });
            } else {
                // Failed login
                const attemptInfo = loginAttempts.recordFailedAttempt(username);
                
                securityLogger.warn('Failed login attempt', {
                    username,
                    ip: clientIp,
                    attempts: attemptInfo.attempts
                });

                // Calculate remaining attempts
                const remainingAttempts = Math.max(0, 5 - attemptInfo.attempts);
                
                res.status(401).json({
                    success: false,
                    error: remainingAttempts > 0 
                        ? `Ungültige Anmeldedaten. Noch ${remainingAttempts} Versuch${remainingAttempts !== 1 ? 'e' : ''} übrig.`
                        : 'Ungültige Anmeldedaten.',
                    remainingAttempts
                });
            }
        } catch (error) {
            logger.error('Login error:', { error: error.message });
            res.status(500).json({
                success: false,
                error: 'Ein Fehler ist aufgetreten. Bitte versuchen Sie es später erneut.'
            });
        }
    }
);

/**
 * POST /api/auth/logout
 * Logs out the current user
 */
router.post('/logout', (req, res) => {
    const username = req.session?.username;
    
    req.session.destroy((err) => {
        if (err) {
            logger.error('Error destroying session:', { error: err.message });
            return res.status(500).json({
                success: false,
                error: 'Logout fehlgeschlagen'
            });
        }

        if (username) {
            securityLogger.info('User logged out', { username });
        }

        res.json({
            success: true,
            message: 'Erfolgreich abgemeldet'
        });
    });
});

/**
 * GET /api/auth/status
 * Returns the current authentication status
 */
router.get('/status', (req, res) => {
    if (req.session && req.session.userId) {
        res.json({
            authenticated: true,
            user: {
                userId: req.session.userId,
                username: req.session.username,
                role: req.session.role
            }
        });
    } else {
        res.json({
            authenticated: false
        });
    }
});

module.exports = router;
