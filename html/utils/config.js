/**
 * Security configuration
 * Central configuration for security settings
 */

module.exports = {
    // Session configuration
    session: {
        secret: process.env.SESSION_SECRET,
        name: 'hive.sid',
        resave: false,
        saveUninitialized: false,
        rolling: true, // Reset expiration on every response
        cookie: {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production', // HTTPS only in production
            sameSite: 'strict',
            maxAge: 10 * 60 * 1000 // 10 minutes
        }
    },

    // Session timeout configuration
    sessionTimeout: {
        inactivityTimeout: 10 * 60 * 1000, // 10 minutes in milliseconds
        checkInterval: 60 * 1000 // Check every minute
    },

    // Rate limiting configuration
    rateLimit: {
        windowMs: 15 * 60 * 1000, // 15 minutes
        max: 5, // 5 requests per window
        message: 'Zu viele Login-Versuche. Bitte versuchen Sie es später erneut.',
        standardHeaders: true,
        legacyHeaders: false,
        skipSuccessfulRequests: true // Don't count successful logins
    },

    // reCAPTCHA configuration
    recaptcha: {
        enabled: !!(process.env.RECAPTCHA_SITE_KEY && process.env.RECAPTCHA_SECRET_KEY),
        siteKey: process.env.RECAPTCHA_SITE_KEY,
        secretKey: process.env.RECAPTCHA_SECRET_KEY,
        verifyUrl: 'https://www.google.com/recaptcha/api/siteverify'
    },

    // Password requirements
    password: {
        minLength: 16,
        requireUppercase: true,
        requireLowercase: true,
        requireNumbers: true,
        requireSpecialChars: true,
        specialChars: '!@#$%^&*()_+-=[]{}|;:,.<>?'
    },

    // CSRF configuration
    csrf: {
        cookie: {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            sameSite: 'strict'
        }
    },

    // Helmet security headers
    helmet: {
        contentSecurityPolicy: {
            directives: {
                defaultSrc: ["'self'"],
                scriptSrc: ["'self'", "'unsafe-inline'", "https://www.google.com", "https://www.gstatic.com"],
                styleSrc: ["'self'", "'unsafe-inline'"],
                imgSrc: ["'self'", "data:", "https:"],
                connectSrc: ["'self'"],
                fontSrc: ["'self'"],
                objectSrc: ["'none'"],
                mediaSrc: ["'self'"],
                frameSrc: ["https://www.google.com"]
            }
        },
        hsts: {
            maxAge: 31536000,
            includeSubDomains: true,
            preload: true
        }
    }
};
