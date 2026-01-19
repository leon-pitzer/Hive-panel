/**
 * RateLimit.js - Rate Limiting System
 * Implements intelligent rate limiting for login attempts
 * Prevents brute force attacks with progressive lockout periods
 */

const RateLimit = (function() {
    'use strict';
    
    const RATE_LIMIT_KEY = 'hive_rate_limit';
    
    // Lockout configuration
    const LOCKOUT_RULES = [
        { attempts: 5, duration: 1 * 60 * 1000 },      // 5 attempts = 1 minute
        { attempts: 10, duration: 5 * 60 * 1000 },     // 10 attempts = 5 minutes
        { attempts: 20, duration: 60 * 60 * 1000 },    // 20 attempts = 1 hour
        { attempts: Infinity, duration: 24 * 60 * 60 * 1000 } // 20+ attempts = 24 hours
    ];
    
    /**
     * Gets the rate limit data for a specific identifier (username or IP)
     * @param {string} identifier - Username or IP address
     * @returns {Object} Rate limit data
     */
    function getRateLimitData(identifier) {
        try {
            const data = localStorage.getItem(RATE_LIMIT_KEY);
            const allData = data ? JSON.parse(data) : {};
            
            return allData[identifier] || {
                attempts: 0,
                lockedUntil: null,
                lastAttempt: null
            };
        } catch (error) {
            console.error('Failed to get rate limit data:', error);
            return {
                attempts: 0,
                lockedUntil: null,
                lastAttempt: null
            };
        }
    }
    
    /**
     * Saves rate limit data for a specific identifier
     * @param {string} identifier - Username or IP address
     * @param {Object} rateLimitData - Rate limit data to save
     */
    function saveRateLimitData(identifier, rateLimitData) {
        try {
            const data = localStorage.getItem(RATE_LIMIT_KEY);
            const allData = data ? JSON.parse(data) : {};
            
            allData[identifier] = rateLimitData;
            localStorage.setItem(RATE_LIMIT_KEY, JSON.stringify(allData));
        } catch (error) {
            console.error('Failed to save rate limit data:', error);
        }
    }
    
    /**
     * Checks if an identifier is currently locked out
     * @param {string} identifier - Username or IP address
     * @returns {Object} { isLocked: boolean, remainingTime: number|null }
     */
    function checkLockout(identifier) {
        const data = getRateLimitData(identifier);
        
        if (!data.lockedUntil) {
            return { isLocked: false, remainingTime: null };
        }
        
        const now = Date.now();
        const lockedUntil = new Date(data.lockedUntil).getTime();
        
        if (now >= lockedUntil) {
            // Lock has expired
            return { isLocked: false, remainingTime: null };
        }
        
        const remainingTime = lockedUntil - now;
        return { isLocked: true, remainingTime };
    }
    
    /**
     * Records a failed login attempt
     * @param {string} identifier - Username or IP address
     * @returns {Object} Updated lockout status
     */
    function recordFailedAttempt(identifier) {
        const data = getRateLimitData(identifier);
        const lockout = checkLockout(identifier);
        
        // If already locked, just return the current status
        if (lockout.isLocked) {
            return {
                isLocked: true,
                remainingTime: lockout.remainingTime,
                attempts: data.attempts
            };
        }
        
        // Increment attempts
        data.attempts += 1;
        data.lastAttempt = new Date().toISOString();
        
        // Determine lockout duration based on attempts
        // Find the appropriate rule for the current attempt count
        let lockoutRule = LOCKOUT_RULES[0]; // Default to first rule
        for (let i = LOCKOUT_RULES.length - 1; i >= 0; i--) {
            if (data.attempts >= LOCKOUT_RULES[i].attempts) {
                lockoutRule = LOCKOUT_RULES[i];
                break;
            }
        }
        
        // Apply lockout if threshold reached
        if (data.attempts >= 5) {
            const lockoutUntil = new Date(Date.now() + lockoutRule.duration);
            data.lockedUntil = lockoutUntil.toISOString();
        }
        
        saveRateLimitData(identifier, data);
        
        // Check new lockout status
        const newLockout = checkLockout(identifier);
        return {
            isLocked: newLockout.isLocked,
            remainingTime: newLockout.remainingTime,
            attempts: data.attempts
        };
    }
    
    /**
     * Resets the rate limit for an identifier (after successful login)
     * @param {string} identifier - Username or IP address
     */
    function reset(identifier) {
        try {
            const data = localStorage.getItem(RATE_LIMIT_KEY);
            const allData = data ? JSON.parse(data) : {};
            
            delete allData[identifier];
            localStorage.setItem(RATE_LIMIT_KEY, JSON.stringify(allData));
        } catch (error) {
            console.error('Failed to reset rate limit:', error);
        }
    }
    
    /**
     * Formats remaining time into a human-readable string
     * @param {number} milliseconds - Time in milliseconds
     * @returns {string} Formatted time string
     */
    function formatRemainingTime(milliseconds) {
        if (!milliseconds) return '';
        
        const seconds = Math.ceil(milliseconds / 1000);
        const minutes = Math.floor(seconds / 60);
        const hours = Math.floor(minutes / 60);
        const days = Math.floor(hours / 24);
        
        if (days > 0) {
            return `${days} Tag${days !== 1 ? 'e' : ''}`;
        } else if (hours > 0) {
            return `${hours} Stunde${hours !== 1 ? 'n' : ''}`;
        } else if (minutes > 0) {
            const remainingSeconds = seconds % 60;
            if (remainingSeconds > 0) {
                return `${minutes} Minute${minutes !== 1 ? 'n' : ''} und ${remainingSeconds} Sekunde${remainingSeconds !== 1 ? 'n' : ''}`;
            }
            return `${minutes} Minute${minutes !== 1 ? 'n' : ''}`;
        } else {
            return `${seconds} Sekunde${seconds !== 1 ? 'n' : ''}`;
        }
    }
    
    /**
     * Gets a user-friendly message about the lockout status
     * @param {string} identifier - Username or IP address
     * @returns {string|null} Message or null if not locked
     */
    function getLockoutMessage(identifier) {
        const lockout = checkLockout(identifier);
        
        if (!lockout.isLocked) {
            return null;
        }
        
        const timeRemaining = formatRemainingTime(lockout.remainingTime);
        const data = getRateLimitData(identifier);
        
        return `Zu viele Fehlversuche (${data.attempts}). Bitte versuchen Sie es in ${timeRemaining} erneut.`;
    }
    
    /**
     * Gets the number of failed attempts for an identifier
     * @param {string} identifier - Username or IP address
     * @returns {number} Number of failed attempts
     */
    function getAttempts(identifier) {
        const data = getRateLimitData(identifier);
        return data.attempts;
    }
    
    /**
     * Cleans up expired lockouts (maintenance function)
     */
    function cleanupExpired() {
        try {
            const data = localStorage.getItem(RATE_LIMIT_KEY);
            if (!data) return;
            
            const allData = JSON.parse(data);
            const now = Date.now();
            let cleaned = false;
            
            for (const identifier in allData) {
                const rateLimitData = allData[identifier];
                if (rateLimitData.lockedUntil) {
                    const lockedUntil = new Date(rateLimitData.lockedUntil).getTime();
                    if (now >= lockedUntil) {
                        delete allData[identifier];
                        cleaned = true;
                    }
                }
            }
            
            if (cleaned) {
                localStorage.setItem(RATE_LIMIT_KEY, JSON.stringify(allData));
            }
        } catch (error) {
            console.error('Failed to cleanup expired lockouts:', error);
        }
    }
    
    // Public API
    return {
        checkLockout,
        recordFailedAttempt,
        reset,
        formatRemainingTime,
        getLockoutMessage,
        getAttempts,
        cleanupExpired
    };
})();

// Make RateLimit available globally
if (typeof window !== 'undefined') {
    window.RateLimit = RateLimit;
    
    // Run cleanup on load and periodically
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => {
            RateLimit.cleanupExpired();
            // Cleanup every hour
            setInterval(() => RateLimit.cleanupExpired(), 60 * 60 * 1000);
        });
    } else {
        RateLimit.cleanupExpired();
        setInterval(() => RateLimit.cleanupExpired(), 60 * 60 * 1000);
    }
}
