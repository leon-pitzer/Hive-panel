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
const { getPool } = require('../html/utils/database');

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
    let connection;
    
    try {
        connection = await getPool().getConnection();
        
        // Check if any admin exists with superadmin role or admin_all permission
        const [adminRows] = await connection.query(
            `SELECT u.id, u.username, u.role
            FROM users u
            LEFT JOIN user_permissions up ON u.id = up.user_id
            LEFT JOIN permissions p ON up.permission_id = p.id
            WHERE u.role IN ('superadmin', 'admin') 
               OR p.name = '*'
               OR p.name = 'admin_all'
            LIMIT 1`
        );

        if (adminRows.length > 0) {
            // Admin exists, no need to create
            return null;
        }

        logger.info('No admin user found. Creating default admin...');

        // Start transaction
        await connection.beginTransaction();

        // Generate secure password
        const password = generateSecurePassword();

        // Hash password
        const salt = await bcrypt.genSalt(10);
        const passwordHash = await bcrypt.hash(password, salt);

        // Create admin user with superadmin role
        const [result] = await connection.query(
            `INSERT INTO users (username, password_hash, role, must_change_password)
            VALUES (?, ?, ?, ?)`,
            ['admin', passwordHash, 'superadmin', true]
        );

        const adminId = result.insertId;

        // Add admin_all permission for compatibility
        const [permRows] = await connection.query(
            'SELECT id FROM permissions WHERE name = ? LIMIT 1',
            ['admin_all']
        );

        if (permRows.length > 0) {
            await connection.query(
                'INSERT INTO user_permissions (user_id, permission_id) VALUES (?, ?)',
                [adminId, permRows[0].id]
            );
        }

        // Commit transaction
        await connection.commit();

        logger.info('[OK] Default admin user created successfully in database');
        console.log('\n' + '='.repeat(70));
        console.log('[OK] Standard-Admin-Benutzer erstellt:');
        console.log('   Benutzername: admin');
        console.log('   Passwort: ' + password);
        console.log('   Rolle: superadmin');
        console.log('   Permissions: Alle (Superadmin - Voller Zugriff)');
        console.log('');
        console.log('   [!] WICHTIG: Ändern Sie das Passwort nach der ersten Anmeldung!');
        console.log('='.repeat(70) + '\n');

        return {
            username: 'admin',
            created: true
        };
    } catch (error) {
        // Rollback on error
        if (connection) {
            await connection.rollback();
        }
        logger.error('Error ensuring default admin exists:', { error: error.message });
        return null;
    } finally {
        if (connection) {
            connection.release();
        }
    }
}

/**
 * Gets a user by username
 * @param {string} username - Username to find
 * @returns {Promise<Object|null>} User object or null
 */
async function getUserByUsername(username) {
    try {
        const pool = getPool();
        const [rows] = await pool.query(
            `SELECT 
                u.id,
                u.username,
                u.password_hash AS passwordHash,
                u.email,
                u.display_name AS displayName,
                u.role,
                u.created_at AS createdAt,
                u.created_by AS createdBy,
                u.updated_at AS updatedAt,
                u.must_change_password AS mustChangePassword
            FROM users u
            WHERE u.username = ?
            LIMIT 1`,
            [username]
        );

        if (rows.length === 0) {
            return null;
        }

        const user = rows[0];

        // Get user's direct permissions
        const [permRows] = await pool.query(
            `SELECT p.name
            FROM user_permissions up
            JOIN permissions p ON up.permission_id = p.id
            WHERE up.user_id = ?`,
            [user.id]
        );
        user.permissions = permRows.map(row => row.name);

        // Get user's roles
        const [roleRows] = await pool.query(
            `SELECT ur.role_id
            FROM user_roles ur
            WHERE ur.user_id = ?`,
            [user.id]
        );
        user.roles = roleRows.map(row => row.role_id);

        return user;
    } catch (error) {
        logger.error('Error getting user from database:', { 
            error: error.message,
            username 
        });
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
 * @param {string} createdBy - Username of creator (optional)
 * @returns {Promise<boolean>} Success status
 */
async function createUser(username, password, role = 'user', permissions = [], roles = [], createdBy = null) {
    let connection;
    
    try {
        connection = await getPool().getConnection();
        
        // Validate input
        if (!username || !password) {
            logger.error('Username and password are required');
            return false;
        }

        // Start transaction
        await connection.beginTransaction();

        // Check if user already exists
        const [existing] = await connection.query(
            'SELECT id FROM users WHERE username = ? LIMIT 1',
            [username]
        );
        
        if (existing.length > 0) {
            logger.error('User already exists:', { username });
            if (connection) {
                await connection.rollback();
            }
            return false;
        }

        // Hash password
        const salt = await bcrypt.genSalt(10);
        const passwordHash = await bcrypt.hash(password, salt);

        // Insert user
        const [result] = await connection.query(
            `INSERT INTO users (username, password_hash, role, created_by)
            VALUES (?, ?, ?, ?)`,
            [username, passwordHash, role, createdBy]
        );

        const userId = result.insertId;

        // Insert direct permissions
        if (permissions && permissions.length > 0) {
            for (const permName of permissions) {
                // Get permission ID
                const [permRows] = await connection.query(
                    'SELECT id FROM permissions WHERE name = ? LIMIT 1',
                    [permName]
                );
                
                if (permRows.length > 0) {
                    await connection.query(
                        'INSERT INTO user_permissions (user_id, permission_id) VALUES (?, ?)',
                        [userId, permRows[0].id]
                    );
                }
            }
        }

        // Insert user roles
        if (roles && roles.length > 0) {
            for (const roleId of roles) {
                // Verify role exists
                const [roleRows] = await connection.query(
                    'SELECT id FROM roles WHERE id = ? LIMIT 1',
                    [roleId]
                );
                
                if (roleRows.length > 0) {
                    await connection.query(
                        'INSERT INTO user_roles (user_id, role_id) VALUES (?, ?)',
                        [userId, roleId]
                    );
                }
            }
        }

        // Commit transaction
        await connection.commit();

        logger.info('User created successfully in database:', { username, role, permissions, roles });
        return true;
    } catch (error) {
        // Rollback on error
        if (connection) {
            await connection.rollback();
        }
        logger.error('Error creating user in database:', { 
            error: error.message,
            username 
        });
        return false;
    } finally {
        if (connection) {
            connection.release();
        }
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
