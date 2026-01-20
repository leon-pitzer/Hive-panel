/**
 * Environment validation
 * Validates required environment variables at startup
 */

const crypto = require('crypto');
const { logger } = require('./logger');

/**
 * Validates environment variables
 * @returns {boolean} True if all required variables are valid
 */
function validateEnv() {
    const errors = [];
    const warnings = [];

    // Check NODE_ENV
    const validNodeEnvs = ['development', 'production', 'test'];
    if (!process.env.NODE_ENV) {
        process.env.NODE_ENV = 'development';
        warnings.push('NODE_ENV not set, defaulting to "development"');
    } else if (!validNodeEnvs.includes(process.env.NODE_ENV)) {
        warnings.push(`NODE_ENV="${process.env.NODE_ENV}" is not standard. Expected: ${validNodeEnvs.join(', ')}`);
    }

    // Check PORT
    if (!process.env.PORT) {
        process.env.PORT = '3000';
        warnings.push('PORT not set, defaulting to 3000');
    } else {
        const port = parseInt(process.env.PORT, 10);
        if (isNaN(port) || port < 1 || port > 65535) {
            errors.push('PORT must be a number between 1 and 65535');
        }
    }

    // Check SESSION_SECRET
    if (!process.env.SESSION_SECRET) {
        // Generate a random session secret
        process.env.SESSION_SECRET = crypto.randomBytes(64).toString('hex');
        warnings.push('SESSION_SECRET not set, generated a random one. IMPORTANT: Set a permanent SESSION_SECRET in .env for production!');
        logger.warn('⚠️  Generated SESSION_SECRET (save this to .env):', { secret: process.env.SESSION_SECRET });
    } else if (process.env.SESSION_SECRET.length < 32) {
        errors.push('SESSION_SECRET must be at least 32 characters long (recommended: 128 characters)');
    }

    // Check reCAPTCHA keys
    const hasSiteKey = !!process.env.RECAPTCHA_SITE_KEY;
    const hasSecretKey = !!process.env.RECAPTCHA_SECRET_KEY;

    if (hasSiteKey && !hasSecretKey) {
        errors.push('RECAPTCHA_SITE_KEY is set but RECAPTCHA_SECRET_KEY is missing');
    } else if (!hasSiteKey && hasSecretKey) {
        errors.push('RECAPTCHA_SECRET_KEY is set but RECAPTCHA_SITE_KEY is missing');
    } else if (!hasSiteKey && !hasSecretKey) {
        warnings.push('reCAPTCHA is disabled (no keys configured). Set RECAPTCHA_SITE_KEY and RECAPTCHA_SECRET_KEY to enable bot protection.');
    }

    // Check MySQL Database Configuration
    if (!process.env.DB_HOST) {
        errors.push('DB_HOST is required for MySQL database connection');
    }
    if (!process.env.DB_USER) {
        errors.push('DB_USER is required for MySQL database connection');
    }
    if (!process.env.DB_PASSWORD) {
        errors.push('DB_PASSWORD is required for MySQL database connection');
    }
    if (!process.env.DB_NAME) {
        errors.push('DB_NAME is required for MySQL database connection');
    }
    if (process.env.DB_PORT) {
        const dbPort = parseInt(process.env.DB_PORT, 10);
        if (isNaN(dbPort) || dbPort < 1 || dbPort > 65535) {
            errors.push('DB_PORT must be a number between 1 and 65535');
        }
    }

    // Log warnings
    warnings.forEach(warning => {
        logger.warn(`⚠️  ${warning}`);
    });

    // Log errors
    if (errors.length > 0) {
        errors.forEach(error => {
            logger.error(`❌ ${error}`);
        });
        return false;
    }

    // Log success
    if (errors.length === 0 && warnings.length === 0) {
        logger.info('✅ Environment validation passed');
    }

    return true;
}

/**
 * Gets environment info for logging
 * @returns {Object} Environment information
 */
function getEnvInfo() {
    return {
        nodeEnv: process.env.NODE_ENV,
        port: process.env.PORT,
        recaptchaEnabled: !!(process.env.RECAPTCHA_SITE_KEY && process.env.RECAPTCHA_SECRET_KEY),
        nodeVersion: process.version
    };
}

module.exports = {
    validateEnv,
    getEnvInfo
};
