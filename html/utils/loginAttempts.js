/**
 * Login attempts tracking
 * Tracks failed login attempts for rate limiting
 */

const { securityLogger } = require('./logger');
const config = require('./config');

// In-memory store for login attempts
// In production, consider using Redis or database
const loginAttempts = new Map();

// Cleanup interval to remove old entries
const CLEANUP_INTERVAL = 60 * 60 * 1000; // 1 hour
const MAX_AGE = 24 * 60 * 60 * 1000; // 24 hours

/**
 * Records a failed login attempt
 * @param {string} identifier - Username or IP address
 * @returns {Object} Attempt info { attempts: number, lockedUntil: Date|null }
 */
function recordFailedAttempt(identifier) {
    const now = Date.now();
    const attempts = loginAttempts.get(identifier) || {
        count: 0,
        firstAttempt: now,
        lastAttempt: now,
        lockedUntil: null
    };

    attempts.count++;
    attempts.lastAttempt = now;

    // Calculate lockout based on attempt count using config values
    if (attempts.count >= 5) {
        let lockoutDuration;
        if (attempts.count >= 20) {
            lockoutDuration = config.loginAttempts.lockout20Attempts;
        } else if (attempts.count >= 10) {
            lockoutDuration = config.loginAttempts.lockout10Attempts;
        } else if (attempts.count >= 5) {
            lockoutDuration = config.loginAttempts.lockout5Attempts;
        }
        
        attempts.lockedUntil = new Date(now + lockoutDuration);
    }

    loginAttempts.set(identifier, attempts);

    securityLogger.warn('Failed login attempt recorded', {
        identifier,
        attempts: attempts.count,
        lockedUntil: attempts.lockedUntil
    });

    return {
        attempts: attempts.count,
        lockedUntil: attempts.lockedUntil
    };
}

/**
 * Checks if an identifier is locked
 * @param {string} identifier - Username or IP address
 * @returns {Object} Lock status { isLocked: boolean, remainingTime: number|null }
 */
function isLocked(identifier) {
    const attempts = loginAttempts.get(identifier);
    
    if (!attempts || !attempts.lockedUntil) {
        return { isLocked: false, remainingTime: null };
    }

    const now = Date.now();
    const lockedUntil = attempts.lockedUntil.getTime();

    if (now >= lockedUntil) {
        // Lock expired, remove it
        attempts.lockedUntil = null;
        loginAttempts.set(identifier, attempts);
        return { isLocked: false, remainingTime: null };
    }

    const remainingTime = lockedUntil - now;
    return { isLocked: true, remainingTime };
}

/**
 * Resets attempts for an identifier (after successful login)
 * @param {string} identifier - Username or IP address
 */
function resetAttempts(identifier) {
    loginAttempts.delete(identifier);
    securityLogger.info('Login attempts reset', { identifier });
}

/**
 * Gets attempt count for an identifier
 * @param {string} identifier - Username or IP address
 * @returns {number} Number of attempts
 */
function getAttemptCount(identifier) {
    const attempts = loginAttempts.get(identifier);
    return attempts ? attempts.count : 0;
}

/**
 * Cleans up old entries
 */
function cleanup() {
    const now = Date.now();
    let cleaned = 0;

    for (const [identifier, attempts] of loginAttempts.entries()) {
        const age = now - attempts.firstAttempt;
        if (age > MAX_AGE) {
            loginAttempts.delete(identifier);
            cleaned++;
        }
    }

    if (cleaned > 0) {
        securityLogger.info(`Cleaned up ${cleaned} old login attempt entries`);
    }
}

// Start cleanup interval
setInterval(cleanup, CLEANUP_INTERVAL);

module.exports = {
    recordFailedAttempt,
    isLocked,
    resetAttempts,
    getAttemptCount
};
