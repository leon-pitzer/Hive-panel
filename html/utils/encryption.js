/**
 * Encryption Utility for Email and Sensitive Data
 * Uses AES-256-GCM encryption
 */

const crypto = require('crypto');
const { logger } = require('./logger');

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 16; // For AES, this is always 16
const SALT_LENGTH = 64;
const TAG_LENGTH = 16;
const ITERATIONS = 100000; // PBKDF2 iterations

/**
 * Get encryption key from environment
 * @returns {string} Encryption key
 */
function getEncryptionKey() {
    const key = process.env.ENCRYPTION_KEY;
    
    if (!key) {
        logger.error('ENCRYPTION_KEY is not set in environment variables');
        throw new Error('ENCRYPTION_KEY is required for encryption');
    }
    
    if (key.length < 32) {
        logger.error('ENCRYPTION_KEY is too short. Must be at least 32 characters');
        throw new Error('ENCRYPTION_KEY must be at least 32 characters');
    }
    
    return key;
}

/**
 * Derive a key from the encryption key using PBKDF2
 * @param {string} password - The base encryption key
 * @param {Buffer} salt - Salt for key derivation
 * @returns {Buffer} Derived key
 */
function deriveKey(password, salt) {
    return crypto.pbkdf2Sync(password, salt, ITERATIONS, 32, 'sha256');
}

/**
 * Encrypt text using AES-256-GCM
 * @param {string} text - Plain text to encrypt
 * @returns {string} Encrypted text (base64 encoded with IV, salt, and auth tag)
 */
function encrypt(text) {
    try {
        if (!text) {
            return null;
        }
        
        const encryptionKey = getEncryptionKey();
        
        // Generate random IV and salt
        const iv = crypto.randomBytes(IV_LENGTH);
        const salt = crypto.randomBytes(SALT_LENGTH);
        
        // Derive key from encryption key and salt
        const key = deriveKey(encryptionKey, salt);
        
        // Create cipher
        const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
        
        // Encrypt
        let encrypted = cipher.update(text, 'utf8', 'hex');
        encrypted += cipher.final('hex');
        
        // Get auth tag
        const authTag = cipher.getAuthTag();
        
        // Combine salt + iv + authTag + encrypted data
        const combined = Buffer.concat([
            salt,
            iv,
            authTag,
            Buffer.from(encrypted, 'hex')
        ]);
        
        // Return as base64
        return combined.toString('base64');
    } catch (error) {
        logger.error('Encryption error:', { error: error.message });
        throw new Error('Failed to encrypt data');
    }
}

/**
 * Decrypt text using AES-256-GCM
 * @param {string} encryptedData - Encrypted text (base64 encoded)
 * @returns {string} Decrypted plain text
 */
function decrypt(encryptedData) {
    try {
        if (!encryptedData) {
            return null;
        }
        
        const encryptionKey = getEncryptionKey();
        
        // Convert from base64
        const combined = Buffer.from(encryptedData, 'base64');
        
        // Extract components
        const salt = combined.slice(0, SALT_LENGTH);
        const iv = combined.slice(SALT_LENGTH, SALT_LENGTH + IV_LENGTH);
        const authTag = combined.slice(
            SALT_LENGTH + IV_LENGTH,
            SALT_LENGTH + IV_LENGTH + TAG_LENGTH
        );
        const encrypted = combined.slice(SALT_LENGTH + IV_LENGTH + TAG_LENGTH);
        
        // Derive key from encryption key and salt
        const key = deriveKey(encryptionKey, salt);
        
        // Create decipher
        const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
        decipher.setAuthTag(authTag);
        
        // Decrypt
        let decrypted = decipher.update(encrypted, undefined, 'utf8');
        decrypted += decipher.final('utf8');
        
        return decrypted;
    } catch (error) {
        logger.error('Decryption error:', { error: error.message });
        throw new Error('Failed to decrypt data');
    }
}

/**
 * Check if encryption is properly configured
 * @returns {boolean} True if encryption is configured
 */
function isEncryptionConfigured() {
    try {
        const key = process.env.ENCRYPTION_KEY;
        return key && key.length >= 32;
    } catch {
        return false;
    }
}

module.exports = {
    encrypt,
    decrypt,
    isEncryptionConfigured
};
