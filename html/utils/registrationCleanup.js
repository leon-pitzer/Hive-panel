/**
 * Registration Request Cleanup Utility
 * Automatically removes old registration requests based on rules:
 * - Rejected requests: Delete after 30 days
 * - Pending requests: Delete after 180 days (6 months)
 */

const path = require('path');
const { readJsonFile, writeJsonFile } = require('./fileOperations');
const { logger } = require('./logger');

const REQUESTS_FILE = path.join(__dirname, '../../data/registration-requests.json');

// Cleanup rules in milliseconds
const CLEANUP_RULES = {
    rejected: 30 * 24 * 60 * 60 * 1000, // 30 days
    pending: 180 * 24 * 60 * 60 * 1000  // 180 days (6 months)
};

/**
 * Cleans up old registration requests based on rules
 * @returns {Promise<Object>} Cleanup statistics
 */
async function cleanupOldRegistrationRequests() {
    try {
        logger.info('Starting registration requests cleanup...');
        
        // TODO: Replace with MySQL query in future
        // DELETE FROM registration_requests WHERE 
        //   (status = 'rejected' AND rejectedAt < NOW() - INTERVAL 30 DAY) OR
        //   (status = 'pending' AND createdAt < NOW() - INTERVAL 180 DAY)
        
        const data = await readJsonFile(REQUESTS_FILE, { requests: [] });
        const now = Date.now();
        const originalCount = data.requests.length;
        
        // Filter out requests that should be deleted
        const filteredRequests = data.requests.filter(request => {
            // Check rejected requests
            if (request.status === 'rejected' && request.rejectedAt) {
                const rejectedTime = new Date(request.rejectedAt).getTime();
                const age = now - rejectedTime;
                
                if (age > CLEANUP_RULES.rejected) {
                    logger.info('Removing old rejected request', {
                        id: request.id,
                        username: request.username,
                        age: Math.floor(age / (24 * 60 * 60 * 1000)) + ' days'
                    });
                    return false; // Remove
                }
            }
            
            // Check pending requests
            if (request.status === 'pending' && request.createdAt) {
                const createdTime = new Date(request.createdAt).getTime();
                const age = now - createdTime;
                
                if (age > CLEANUP_RULES.pending) {
                    logger.info('Removing old pending request', {
                        id: request.id,
                        username: request.username,
                        age: Math.floor(age / (24 * 60 * 60 * 1000)) + ' days'
                    });
                    return false; // Remove
                }
            }
            
            return true; // Keep
        });
        
        const removedCount = originalCount - filteredRequests.length;
        
        // Save cleaned data if anything was removed
        if (removedCount > 0) {
            data.requests = filteredRequests;
            await writeJsonFile(REQUESTS_FILE, data);
            
            logger.info('Registration requests cleanup completed', {
                originalCount,
                removedCount,
                remainingCount: filteredRequests.length
            });
        } else {
            logger.info('No old registration requests to clean up');
        }
        
        return {
            success: true,
            originalCount,
            removedCount,
            remainingCount: filteredRequests.length
        };
        
    } catch (error) {
        logger.error('Error during registration requests cleanup:', { error: error.message });
        return {
            success: false,
            error: error.message
        };
    }
}

/**
 * Starts periodic cleanup task
 * Runs cleanup every 24 hours
 * @returns {NodeJS.Timeout} Interval ID
 */
function startPeriodicCleanup() {
    // Run cleanup immediately on start
    cleanupOldRegistrationRequests();
    
    // Run cleanup every 24 hours
    const intervalId = setInterval(() => {
        cleanupOldRegistrationRequests();
    }, 24 * 60 * 60 * 1000);
    
    logger.info('Started periodic registration cleanup task (runs every 24 hours)');
    
    return intervalId;
}

module.exports = {
    cleanupOldRegistrationRequests,
    startPeriodicCleanup
};
