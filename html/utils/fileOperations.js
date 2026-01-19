/**
 * File operations with atomic writes and locking
 * Ensures safe concurrent file access
 */

const fs = require('fs').promises;
const fsSync = require('fs');
const path = require('path');
const lockfile = require('proper-lockfile');
const { logger } = require('./logger');

/**
 * Reads a JSON file with locking
 * @param {string} filePath - Path to JSON file
 * @param {*} defaultValue - Default value if file doesn't exist
 * @returns {Promise<*>} Parsed JSON data
 */
async function readJsonFile(filePath, defaultValue = null) {
    try {
        // Create directory if it doesn't exist
        const dir = path.dirname(filePath);
        await fs.mkdir(dir, { recursive: true });

        // Check if file exists
        try {
            await fs.access(filePath);
        } catch (err) {
            // File doesn't exist, return default value
            return defaultValue;
        }

        // Acquire lock for reading
        let release;
        try {
            release = await lockfile.lock(filePath, {
                retries: {
                    retries: 5,
                    minTimeout: 100,
                    maxTimeout: 1000
                }
            });
        } catch (err) {
            logger.warn(`Could not acquire lock for reading ${filePath}, reading without lock`, { error: err.message });
        }

        try {
            // Read file
            const data = await fs.readFile(filePath, 'utf8');
            return JSON.parse(data);
        } finally {
            // Release lock
            if (release) {
                await release();
            }
        }
    } catch (error) {
        logger.error(`Error reading JSON file ${filePath}:`, { error: error.message });
        return defaultValue;
    }
}

/**
 * Writes a JSON file atomically with locking
 * @param {string} filePath - Path to JSON file
 * @param {*} data - Data to write
 * @returns {Promise<boolean>} Success status
 */
async function writeJsonFile(filePath, data) {
    try {
        // Create directory if it doesn't exist
        const dir = path.dirname(filePath);
        await fs.mkdir(dir, { recursive: true });

        // Acquire lock for writing
        let release;
        
        // Create file if it doesn't exist (required for lockfile)
        if (!fsSync.existsSync(filePath)) {
            await fs.writeFile(filePath, '{}', 'utf8');
        }

        try {
            release = await lockfile.lock(filePath, {
                retries: {
                    retries: 5,
                    minTimeout: 100,
                    maxTimeout: 1000
                }
            });
        } catch (err) {
            logger.warn(`Could not acquire lock for writing ${filePath}, writing without lock`, { error: err.message });
        }

        try {
            // Write to temporary file first
            const tmpPath = `${filePath}.tmp`;
            await fs.writeFile(tmpPath, JSON.stringify(data, null, 2), 'utf8');

            // Atomic rename
            await fs.rename(tmpPath, filePath);

            return true;
        } finally {
            // Release lock
            if (release) {
                await release();
            }
        }
    } catch (error) {
        logger.error(`Error writing JSON file ${filePath}:`, { error: error.message });
        return false;
    }
}

/**
 * Safely updates a JSON file with a callback
 * @param {string} filePath - Path to JSON file
 * @param {Function} updateFn - Function that receives current data and returns updated data
 * @param {*} defaultValue - Default value if file doesn't exist
 * @returns {Promise<boolean>} Success status
 */
async function updateJsonFile(filePath, updateFn, defaultValue = {}) {
    try {
        // Create directory if it doesn't exist
        const dir = path.dirname(filePath);
        await fs.mkdir(dir, { recursive: true });

        // Create file if it doesn't exist
        if (!fsSync.existsSync(filePath)) {
            await fs.writeFile(filePath, JSON.stringify(defaultValue, null, 2), 'utf8');
        }

        // Acquire lock
        const release = await lockfile.lock(filePath, {
            retries: {
                retries: 5,
                minTimeout: 100,
                maxTimeout: 1000
            }
        });

        try {
            // Read current data directly (without using readJsonFile to avoid nested locks)
            let currentData;
            try {
                const fileContent = await fs.readFile(filePath, 'utf8');
                currentData = JSON.parse(fileContent);
            } catch (err) {
                currentData = defaultValue;
            }

            // Apply update function
            const updatedData = updateFn(currentData);

            // Write updated data
            const tmpPath = `${filePath}.tmp`;
            await fs.writeFile(tmpPath, JSON.stringify(updatedData, null, 2), 'utf8');
            await fs.rename(tmpPath, filePath);

            return true;
        } finally {
            await release();
        }
    } catch (error) {
        logger.error(`Error updating JSON file ${filePath}:`, { error: error.message });
        return false;
    }
}

module.exports = {
    readJsonFile,
    writeJsonFile,
    updateJsonFile
};
