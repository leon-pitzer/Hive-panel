/**
 * Users routes and management
 * Handles user creation, management, and default admin setup
 */

const express = require('express');
const bcrypt = require('bcrypt');
const path = require('path');
const crypto = require('crypto');
const { readJsonFile, writeJsonFile } = require('../html/utils/fileOperations');
const { logger, securityLogger } = require('../html/utils/logger');
const config = require('../html/utils/config');

const router = express.Router();
const USERS_FILE = path.join(__dirname, '../data/users.json');

/**
 * Generates a secure random password
 * @returns {string} Secure password
 */
function generateSecurePassword() {
    const length = config.password.minLength;
    const uppercase = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
    const lowercase = 'abcdefghijklmnopqrstuvwxyz';
    const numbers = '0123456789';
    const special = config.password.specialChars;
    
    let password = '';
    
    // Ensure at least one of each required type
    password += uppercase[crypto.randomInt(0, uppercase.length)];
    password += lowercase[crypto.randomInt(0, lowercase.length)];
    password += numbers[crypto.randomInt(0, numbers.length)];
    password += special[crypto.randomInt(0, special.length)];
    
    // Fill the rest with random characters
    const allChars = uppercase + lowercase + numbers + special;
    for (let i = password.length; i < length; i++) {
        password += allChars[crypto.randomInt(0, allChars.length)];
    }
    
    // Shuffle the password using Fisher-Yates algorithm with crypto
    const passwordArray = password.split('');
    for (let i = passwordArray.length - 1; i > 0; i--) {
        const j = crypto.randomInt(0, i + 1);
        [passwordArray[i], passwordArray[j]] = [passwordArray[j], passwordArray[i]];
    }
    
    return passwordArray.join('');
}

/**
 * Ensures a default admin user exists
 * Creates one if no users exist
 * @returns {Promise<Object|null>} Admin info if created, null otherwise
 */
async function ensureDefaultAdmin() {
    try {
        // Read existing users
        const users = await readJsonFile(USERS_FILE, []);
        
        // Check if any admin exists with wildcard permission
        const hasAdmin = users.some(user => 
            user.role === 'admin' || 
            (user.permissions && user.permissions.includes('*'))
        );
        
        if (!hasAdmin) {
            logger.info('No admin user found. Creating default admin...');
            
            // Generate secure password
            const password = generateSecurePassword();
            
            // Hash password
            const salt = await bcrypt.genSalt(10);
            const passwordHash = await bcrypt.hash(password, salt);
            
            // Create admin user with wildcard permission and explicit permissions
            const adminUser = {
                username: 'admin',
                passwordHash: passwordHash,
                role: 'admin',
                permissions: [
                    '*',
                    'accounts.manage',
                    'accounts.view',
                    'accounts.requests',
                    'roles.manage'
                ], // Wildcard permission plus all explicit permissions
                roles: [], // No roles needed with wildcard
                createdAt: new Date().toISOString(),
                mustChangePassword: true
            };
            
            // Add to users array
            users.push(adminUser);
            
            // Save to file
            const success = await writeJsonFile(USERS_FILE, users);
            
            if (success) {
                logger.info('[OK] Default admin user created successfully');
                console.log('\n' + '='.repeat(70));
                console.log('[OK] Standard-Admin-Benutzer erstellt:');
                console.log('   Benutzername: admin');
                console.log('   Passwort: ' + password);
                console.log('   Permissions: * (Wildcard - Voller Zugriff)');
                console.log('');
                console.log('   [!] WICHTIG: Ändern Sie das Passwort nach der ersten Anmeldung!');
                console.log('='.repeat(70) + '\n');
                
                return {
                    username: 'admin',
                    created: true
                };
            } else {
                logger.error('Failed to save default admin user');
                return null;
            }
        }
        
        return null;
    } catch (error) {
        logger.error('Error ensuring default admin exists:', { error: error.message });
        return null;
    }
}

/**
 * Gets a user by username
 * @param {string} username - Username to find
 * @returns {Promise<Object|null>} User object or null
 */
async function getUserByUsername(username) {
    try {
        const users = await readJsonFile(USERS_FILE, []);
        return users.find(user => user.username === username) || null;
    } catch (error) {
        logger.error('Error getting user:', { error: error.message });
        return null;
    }
}

/**
 * Verifies a user's password
 * @param {string} username - Username
 * @param {string} password - Password to verify
 * @returns {Promise<Object|null>} User object (without password) or null
 */
async function verifyUserPassword(username, password) {
    try {
        const user = await getUserByUsername(username);
        
        if (!user || !user.passwordHash) {
            return null;
        }
        
        // Compare password with bcrypt
        const isValid = await bcrypt.compare(password, user.passwordHash);
        
        if (isValid) {
            // Return user without password hash
            const { passwordHash, ...userWithoutPassword } = user;
            return userWithoutPassword;
        }
        
        return null;
    } catch (error) {
        logger.error('Error verifying password:', { error: error.message });
        return null;
    }
}

/**
 * Creates a new user
 * @param {string} username - Username
 * @param {string} password - Password
 * @param {string} role - User role (default: 'user')
 * @param {string[]} permissions - Direct permissions (default: [])
 * @param {string[]} roles - Role IDs (default: [])
 * @returns {Promise<boolean>} Success status
 */
async function createUser(username, password, role = 'user', permissions = [], roles = []) {
    try {
        // Validate input
        if (!username || !password) {
            logger.error('Username and password are required');
            return false;
        }
        
        // Check if user already exists
        const existingUser = await getUserByUsername(username);
        if (existingUser) {
            logger.error('User already exists:', { username });
            return false;
        }
        
        // Hash password
        const salt = await bcrypt.genSalt(10);
        const passwordHash = await bcrypt.hash(password, salt);
        
        // Read existing users
        const users = await readJsonFile(USERS_FILE, []);
        
        // Create new user
        const newUser = {
            username: username,
            passwordHash: passwordHash,
            role: role,
            permissions: permissions || [],
            roles: roles || [],
            createdAt: new Date().toISOString()
        };
        
        // Add user
        users.push(newUser);
        
        // Save to file
        const success = await writeJsonFile(USERS_FILE, users);
        
        if (success) {
            logger.info('User created successfully:', { username, role, permissions, roles });
            return true;
        }
        
        return false;
    } catch (error) {
        logger.error('Error creating user:', { error: error.message });
        return false;
    }
}

module.exports = {
    router,
    ensureDefaultAdmin,
    getUserByUsername,
    verifyUserPassword,
    createUser,
    generateSecurePassword
};
