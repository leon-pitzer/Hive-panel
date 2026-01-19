/**
 * Account Management Routes
 * Handles user account settings and profile management
 */

const express = require('express');
const bcrypt = require('bcrypt');
const { body, validationResult } = require('express-validator');
const rateLimit = require('express-rate-limit');
const csurf = require('csurf');
const { readJsonFile, writeJsonFile } = require('../html/utils/fileOperations');
const { logger, securityLogger } = require('../html/utils/logger');
const { encrypt, decrypt, isEncryptionConfigured } = require('../html/utils/encryption');
const { generateSecurePassword } = require('./users');
const path = require('path');

const router = express.Router();
const USERS_FILE = path.join(__dirname, '../data/users.json');

// CSRF protection
const csrfProtection = csurf({ cookie: true });

// Rate limiting for password changes (stricter)
const passwordChangeLimit = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 3, // 3 attempts per window
    message: { success: false, error: 'Zu viele Passwortänderungen. Bitte versuchen Sie es später erneut.' },
    standardHeaders: true,
    legacyHeaders: false,
});

// Rate limiting for other account changes
const accountChangeLimit = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 10, // 10 attempts per window
    message: { success: false, error: 'Zu viele Anfragen. Bitte versuchen Sie es später erneut.' },
    standardHeaders: true,
    legacyHeaders: false,
});

/**
 * Middleware: Ensure user is authenticated
 */
function requireAuth(req, res, next) {
    if (!req.session || !req.session.userId) {
        return res.status(401).json({
            success: false,
            error: 'Nicht authentifiziert'
        });
    }
    next();
}

/**
 * GET /api/account/profile
 * Get current user profile
 */
router.get('/profile', requireAuth, async (req, res) => {
    try {
        const users = await readJsonFile(USERS_FILE, []);
        const user = users.find(u => u.username === req.session.userId);
        
        if (!user) {
            return res.status(404).json({
                success: false,
                error: 'Benutzer nicht gefunden'
            });
        }
        
        // Decrypt email if exists and encryption is configured
        let email = user.email;
        if (email && isEncryptionConfigured()) {
            try {
                email = decrypt(email);
            } catch (error) {
                logger.error('Failed to decrypt email for user', { username: user.username });
                email = null;
            }
        }
        
        // Return user profile without password hash
        res.json({
            success: true,
            profile: {
                username: user.username,
                role: user.role,
                email: email,
                displayName: user.displayName || null,
                createdAt: user.createdAt,
                updatedAt: user.updatedAt || null
            }
        });
    } catch (error) {
        logger.error('Error fetching profile:', { error: error.message });
        res.status(500).json({
            success: false,
            error: 'Fehler beim Laden des Profils'
        });
    }
});

/**
 * PUT /api/account/username
 * Change username
 */
router.put('/username',
    requireAuth,
    accountChangeLimit,
    csrfProtection,
    [
        body('newUsername')
            .trim()
            .isLength({ min: 3, max: 30 })
            .withMessage('Benutzername muss zwischen 3 und 30 Zeichen lang sein')
            .matches(/^[a-zA-Z0-9_-]+$/)
            .withMessage('Benutzername darf nur Buchstaben, Zahlen, Unterstriche und Bindestriche enthalten')
    ],
    async (req, res) => {
        try {
            const errors = validationResult(req);
            if (!errors.isEmpty()) {
                return res.status(400).json({
                    success: false,
                    error: errors.array()[0].msg
                });
            }
            
            const { newUsername } = req.body;
            const currentUsername = req.session.userId;
            
            // Read users
            const users = await readJsonFile(USERS_FILE, []);
            const userIndex = users.findIndex(u => u.username === currentUsername);
            
            if (userIndex === -1) {
                return res.status(404).json({
                    success: false,
                    error: 'Benutzer nicht gefunden'
                });
            }
            
            // Check if new username already exists
            const usernameExists = users.some(u => u.username === newUsername && u.username !== currentUsername);
            if (usernameExists) {
                return res.status(400).json({
                    success: false,
                    error: 'Benutzername existiert bereits'
                });
            }
            
            // Update username
            users[userIndex].username = newUsername;
            users[userIndex].updatedAt = new Date().toISOString();
            
            // Save
            const success = await writeJsonFile(USERS_FILE, users);
            
            if (success) {
                // Update session
                req.session.userId = newUsername;
                
                securityLogger.info('Username changed', {
                    oldUsername: currentUsername,
                    newUsername: newUsername,
                    ip: req.ip
                });
                
                res.json({
                    success: true,
                    message: 'Benutzername erfolgreich geändert',
                    newUsername: newUsername
                });
            } else {
                throw new Error('Failed to save user data');
            }
        } catch (error) {
            logger.error('Error changing username:', { error: error.message });
            res.status(500).json({
                success: false,
                error: 'Fehler beim Ändern des Benutzernamens'
            });
        }
    }
);

/**
 * PUT /api/account/password
 * Change password (requires current password verification)
 */
router.put('/password',
    requireAuth,
    passwordChangeLimit,
    csrfProtection,
    [
        body('currentPassword')
            .notEmpty()
            .withMessage('Aktuelles Passwort ist erforderlich'),
        body('newPassword')
            .isLength({ min: 8 })
            .withMessage('Neues Passwort muss mindestens 8 Zeichen lang sein')
    ],
    async (req, res) => {
        try {
            const errors = validationResult(req);
            if (!errors.isEmpty()) {
                return res.status(400).json({
                    success: false,
                    error: errors.array()[0].msg
                });
            }
            
            const { currentPassword, newPassword } = req.body;
            const username = req.session.userId;
            
            // Read users
            const users = await readJsonFile(USERS_FILE, []);
            const userIndex = users.findIndex(u => u.username === username);
            
            if (userIndex === -1) {
                return res.status(404).json({
                    success: false,
                    error: 'Benutzer nicht gefunden'
                });
            }
            
            const user = users[userIndex];
            
            // Verify current password
            const isValidPassword = await bcrypt.compare(currentPassword, user.passwordHash);
            if (!isValidPassword) {
                securityLogger.warn('Failed password change attempt - wrong current password', {
                    username: username,
                    ip: req.ip
                });
                
                return res.status(400).json({
                    success: false,
                    error: 'Aktuelles Passwort ist falsch'
                });
            }
            
            // Hash new password
            const salt = await bcrypt.genSalt(10);
            const newPasswordHash = await bcrypt.hash(newPassword, salt);
            
            // Update password
            users[userIndex].passwordHash = newPasswordHash;
            users[userIndex].updatedAt = new Date().toISOString();
            users[userIndex].mustChangePassword = false;
            
            // Save
            const success = await writeJsonFile(USERS_FILE, users);
            
            if (success) {
                securityLogger.info('Password changed successfully', {
                    username: username,
                    ip: req.ip
                });
                
                res.json({
                    success: true,
                    message: 'Passwort erfolgreich geändert'
                });
            } else {
                throw new Error('Failed to save user data');
            }
        } catch (error) {
            logger.error('Error changing password:', { error: error.message });
            res.status(500).json({
                success: false,
                error: 'Fehler beim Ändern des Passworts'
            });
        }
    }
);

/**
 * PUT /api/account/email
 * Add or change email
 */
router.put('/email',
    requireAuth,
    accountChangeLimit,
    csrfProtection,
    [
        body('email')
            .isEmail()
            .withMessage('Ungültige E-Mail-Adresse')
            .normalizeEmail()
    ],
    async (req, res) => {
        try {
            const errors = validationResult(req);
            if (!errors.isEmpty()) {
                return res.status(400).json({
                    success: false,
                    error: errors.array()[0].msg
                });
            }
            
            const { email } = req.body;
            const username = req.session.userId;
            
            // Check if encryption is configured
            if (!isEncryptionConfigured()) {
                logger.error('Email encryption not configured');
                return res.status(500).json({
                    success: false,
                    error: 'E-Mail-Verschlüsselung ist nicht konfiguriert'
                });
            }
            
            // Read users
            const users = await readJsonFile(USERS_FILE, []);
            const userIndex = users.findIndex(u => u.username === username);
            
            if (userIndex === -1) {
                return res.status(404).json({
                    success: false,
                    error: 'Benutzer nicht gefunden'
                });
            }
            
            // Encrypt email
            const encryptedEmail = encrypt(email);
            
            // Update email
            users[userIndex].email = encryptedEmail;
            users[userIndex].updatedAt = new Date().toISOString();
            
            // Save
            const success = await writeJsonFile(USERS_FILE, users);
            
            if (success) {
                securityLogger.info('Email changed', {
                    username: username,
                    ip: req.ip
                });
                
                res.json({
                    success: true,
                    message: 'E-Mail erfolgreich geändert'
                });
            } else {
                throw new Error('Failed to save user data');
            }
        } catch (error) {
            logger.error('Error changing email:', { error: error.message });
            res.status(500).json({
                success: false,
                error: 'Fehler beim Ändern der E-Mail'
            });
        }
    }
);

/**
 * PUT /api/account/displayname
 * Add or change display name
 */
router.put('/displayname',
    requireAuth,
    accountChangeLimit,
    csrfProtection,
    [
        body('displayName')
            .trim()
            .isLength({ min: 1, max: 50 })
            .withMessage('Anzeigename muss zwischen 1 und 50 Zeichen lang sein')
    ],
    async (req, res) => {
        try {
            const errors = validationResult(req);
            if (!errors.isEmpty()) {
                return res.status(400).json({
                    success: false,
                    error: errors.array()[0].msg
                });
            }
            
            const { displayName } = req.body;
            const username = req.session.userId;
            
            // Read users
            const users = await readJsonFile(USERS_FILE, []);
            const userIndex = users.findIndex(u => u.username === username);
            
            if (userIndex === -1) {
                return res.status(404).json({
                    success: false,
                    error: 'Benutzer nicht gefunden'
                });
            }
            
            // Update display name
            users[userIndex].displayName = displayName;
            users[userIndex].updatedAt = new Date().toISOString();
            
            // Save
            const success = await writeJsonFile(USERS_FILE, users);
            
            if (success) {
                logger.info('Display name changed', {
                    username: username
                });
                
                res.json({
                    success: true,
                    message: 'Anzeigename erfolgreich geändert'
                });
            } else {
                throw new Error('Failed to save user data');
            }
        } catch (error) {
            logger.error('Error changing display name:', { error: error.message });
            res.status(500).json({
                success: false,
                error: 'Fehler beim Ändern des Anzeigenamens'
            });
        }
    }
);

/**
 * POST /api/account/generate-password
 * Generate a new secure password
 */
router.post('/generate-password',
    requireAuth,
    accountChangeLimit,
    async (req, res) => {
        try {
            const password = generateSecurePassword();
            
            res.json({
                success: true,
                password: password
            });
        } catch (error) {
            logger.error('Error generating password:', { error: error.message });
            res.status(500).json({
                success: false,
                error: 'Fehler beim Generieren des Passworts'
            });
        }
    }
);

module.exports = router;
