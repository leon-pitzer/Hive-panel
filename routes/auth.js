/**
 * Authentication routes
 * Handles login, logout, auth status, and registration endpoints
 */

const express = require('express');
const { body, validationResult } = require('express-validator');
const rateLimit = require('express-rate-limit');
const bcrypt = require('bcrypt');
const crypto = require('crypto');
const path = require('path');
const { verifyRecaptcha } = require('../html/utils/recaptcha');
const { verifyUserPassword, getUserByUsername } = require('./users');
const { initializeSession } = require('../middleware/sessionValidation');
const loginAttempts = require('../html/utils/loginAttempts');
const { readJsonFile, updateJsonFile } = require('../html/utils/fileOperations');
const { logger, securityLogger } = require('../html/utils/logger');
const config = require('../html/utils/config');

const router = express.Router();
const REQUESTS_FILE = path.join(__dirname, '../data/registration-requests.json');

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

// Rate limiter for registration endpoint (3 per IP per hour)
const registrationLimiter = rateLimit({
    windowMs: 60 * 60 * 1000, // 1 hour
    max: 3, // 3 requests per hour per IP
    message: 'Zu viele Registrierungsanfragen. Bitte versuchen Sie es später erneut.',
    standardHeaders: true,
    legacyHeaders: false,
    handler: (req, res) => {
        securityLogger.warn('Registration rate limit exceeded', {
            ip: req.ip,
            username: req.body.username
        });
        res.status(429).json({
            success: false,
            error: 'Zu viele Registrierungsanfragen. Bitte versuchen Sie es in einer Stunde erneut.'
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

            // Check if user has a pending or rejected registration request
            // TODO: Replace with MySQL query in future
            // SELECT * FROM registration_requests WHERE username = ? LIMIT 1
            const requestsData = await readJsonFile(REQUESTS_FILE, { requests: [] });
            const registrationRequest = requestsData.requests.find(r => r.username === username);
            
            if (registrationRequest) {
                if (registrationRequest.status === 'pending') {
                    securityLogger.info('Login attempt with pending registration', {
                        username,
                        ip: clientIp
                    });
                    return res.status(403).json({
                        success: false,
                        error: 'Ihr Account befindet sich noch in der Warteschlange. Bitte haben Sie Geduld.',
                        status: 'pending'
                    });
                } else if (registrationRequest.status === 'rejected') {
                    securityLogger.info('Login attempt with rejected registration', {
                        username,
                        ip: clientIp
                    });
                    
                    const reason = registrationRequest.rejectionReason 
                        ? ` Grund: ${registrationRequest.rejectionReason}`
                        : '';
                    
                    return res.status(403).json({
                        success: false,
                        error: `Ihr Account wurde abgelehnt.${reason}`,
                        status: 'rejected'
                    });
                }
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
                        role: user.role,
                        permissions: user.permissions || [],
                        roles: user.roles || []
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
                const remainingAttempts = Math.max(0, config.rateLimit.maxLoginAttempts - attemptInfo.attempts);
                
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
                role: req.session.role,
                permissions: req.session.permissions || [],
                roles: req.session.roles || []
            }
        });
    } else {
        res.json({
            authenticated: false
        });
    }
});

/**
 * POST /api/auth/register
 * Register a new user account (requires approval from admin)
 */
router.post('/register',
    registrationLimiter,
    [
        body('username').trim().notEmpty().matches(/^[a-zA-Z0-9_-]+$/).isLength({ min: 3, max: 30 }),
        body('email').isEmail(),
        body('password').isLength({ min: 8 }),
        body('confirmPassword').isLength({ min: 8 })
    ],
    async (req, res) => {
        try {
            // Validate input
            const errors = validationResult(req);
            if (!errors.isEmpty()) {
                return res.status(400).json({
                    success: false,
                    error: 'Ungültige Eingabe',
                    errors: errors.array()
                });
            }
            
            const { username, email, password, confirmPassword } = req.body;
            const clientIp = req.ip;
            
            // Check if passwords match
            if (password !== confirmPassword) {
                return res.status(400).json({
                    success: false,
                    error: 'Die Passwörter stimmen nicht überein.'
                });
            }
            
            // Check if username already exists (in users or requests)
            const existingUser = await getUserByUsername(username);
            if (existingUser) {
                return res.status(409).json({
                    success: false,
                    error: 'Dieser Benutzername ist bereits vergeben.'
                });
            }
            
            // Check if username already has a pending/rejected request
            // TODO: Replace with MySQL query in future
            // SELECT * FROM registration_requests WHERE username = ? OR email = ?
            const requestsData = await readJsonFile(REQUESTS_FILE, { requests: [] });
            const existingRequest = requestsData.requests.find(
                r => r.username === username || r.email === email
            );
            
            if (existingRequest) {
                if (existingRequest.status === 'pending') {
                    return res.status(409).json({
                        success: false,
                        error: 'Eine Registrierungsanfrage mit diesem Benutzernamen oder dieser E-Mail ist bereits ausstehend.'
                    });
                } else if (existingRequest.status === 'rejected') {
                    return res.status(403).json({
                        success: false,
                        error: 'Ihre vorherige Registrierungsanfrage wurde abgelehnt. Bitte kontaktieren Sie einen Administrator.'
                    });
                }
            }
            
            // Hash password
            const salt = await bcrypt.genSalt(10);
            const passwordHash = await bcrypt.hash(password, salt);
            
            // Generate unique request ID
            const requestId = `req-${crypto.randomBytes(12).toString('hex')}`;
            
            // Create registration request
            const newRequest = {
                id: requestId,
                username: username.trim(),
                email: email.trim(),
                passwordHash: passwordHash,
                status: 'pending',
                createdAt: new Date().toISOString(),
                ip: clientIp,
                rejectionReason: null
            };
            
            // Add to requests file
            const success = await updateJsonFile(REQUESTS_FILE, (data) => {
                if (!data.requests) {
                    data.requests = [];
                }
                data.requests.push(newRequest);
                return data;
            }, { requests: [] });
            
            if (success) {
                securityLogger.info('New registration request created', {
                    requestId,
                    username,
                    ip: clientIp
                });
                
                res.json({
                    success: true,
                    message: 'Registrierungsanfrage erfolgreich eingereicht. Sie erhalten eine Benachrichtigung, sobald Ihr Account genehmigt wurde.'
                });
            } else {
                throw new Error('Failed to save registration request');
            }
            
        } catch (error) {
            logger.error('Registration error:', { error: error.message });
            res.status(500).json({
                success: false,
                error: 'Ein Fehler ist aufgetreten. Bitte versuchen Sie es später erneut.'
            });
        }
    }
);

module.exports = router;
