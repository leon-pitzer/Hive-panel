/**
 * Users.js - User Management System
 * Handles user creation, deletion, authentication with bcrypt password hashing
 */

const Users = (function() {
    'use strict';
    
    const USERS_KEY = 'hive_users';
    const DEFAULT_ADMIN = {
        username: 'admin',
        password: 'Admin123!',
        role: 'admin'
    };
    
    /**
     * Initializes the user system
     * Ensures that at least one admin user exists
     */
    function init() {
        ensureAdminExists();
    }
    
    /**
     * Gets all users from storage
     * @returns {Array} Array of user objects (without passwords)
     */
    function getAllUsers() {
        try {
            const usersData = localStorage.getItem(USERS_KEY);
            if (!usersData) {
                return [];
            }
            
            const users = JSON.parse(usersData);
            // Return users without password hashes for security
            return users.map(user => ({
                username: user.username,
                role: user.role,
                createdAt: user.createdAt
            }));
        } catch (error) {
            console.error('Failed to retrieve users:', error);
            return [];
        }
    }
    
    /**
     * Gets a specific user by username
     * @param {string} username - Username to find
     * @returns {Object|null} User object or null
     */
    function getUser(username) {
        try {
            const usersData = localStorage.getItem(USERS_KEY);
            if (!usersData) {
                return null;
            }
            
            const users = JSON.parse(usersData);
            return users.find(user => user.username === username) || null;
        } catch (error) {
            console.error('Failed to retrieve user:', error);
            return null;
        }
    }
    
    /**
     * Creates a new user with hashed password
     * @param {string} username - Username
     * @param {string} password - Plain text password (will be hashed)
     * @param {string} role - User role (default: 'user')
     * @returns {boolean} True if successful, false otherwise
     */
    function createUser(username, password, role = 'user') {
        try {
            // Validate input
            if (!username || !password) {
                console.error('Username and password are required');
                return false;
            }
            
            if (username.length < 3) {
                console.error('Username must be at least 3 characters long');
                return false;
            }
            
            if (password.length < 6) {
                console.error('Password must be at least 6 characters long');
                // NOTE: For production, consider increasing to 8-12 characters
                // and adding complexity requirements (uppercase, lowercase, numbers, special chars)
                return false;
            }
            
            // Check if user already exists
            if (getUser(username)) {
                console.error('User already exists');
                return false;
            }
            
            // Get existing users
            const usersData = localStorage.getItem(USERS_KEY);
            const users = usersData ? JSON.parse(usersData) : [];
            
            // Hash password with bcrypt
            const salt = bcrypt.genSaltSync(10);
            const hashedPassword = bcrypt.hashSync(password, salt);
            
            // Create new user object
            const newUser = {
                username: username,
                passwordHash: hashedPassword,
                role: role,
                createdAt: new Date().toISOString()
            };
            
            // Add user and save
            users.push(newUser);
            localStorage.setItem(USERS_KEY, JSON.stringify(users));
            
            console.log(`User '${username}' created successfully`);
            return true;
        } catch (error) {
            console.error('Failed to create user:', error);
            return false;
        }
    }
    
    /**
     * Deletes a user by username
     * @param {string} username - Username to delete
     * @returns {boolean} True if successful, false otherwise
     */
    function deleteUser(username) {
        try {
            const usersData = localStorage.getItem(USERS_KEY);
            if (!usersData) {
                return false;
            }
            
            const users = JSON.parse(usersData);
            const userIndex = users.findIndex(user => user.username === username);
            
            if (userIndex === -1) {
                console.error('User not found');
                return false;
            }
            
            // Prevent deleting the last admin
            const user = users[userIndex];
            if (user.role === 'admin') {
                const adminCount = users.filter(u => u.role === 'admin').length;
                if (adminCount <= 1) {
                    console.error('Cannot delete the last admin user');
                    return false;
                }
            }
            
            users.splice(userIndex, 1);
            localStorage.setItem(USERS_KEY, JSON.stringify(users));
            
            console.log(`User '${username}' deleted successfully`);
            return true;
        } catch (error) {
            console.error('Failed to delete user:', error);
            return false;
        }
    }
    
    /**
     * Verifies a user's password
     * @param {string} username - Username
     * @param {string} password - Plain text password to verify
     * @returns {Object|null} User object (without password) if valid, null otherwise
     */
    function verifyPassword(username, password) {
        try {
            const user = getUser(username);
            if (!user || !user.passwordHash) {
                return null;
            }
            
            // Compare password with bcrypt
            const isValid = bcrypt.compareSync(password, user.passwordHash);
            
            if (isValid) {
                // Return user without password hash
                return {
                    username: user.username,
                    role: user.role,
                    createdAt: user.createdAt
                };
            }
            
            return null;
        } catch (error) {
            console.error('Failed to verify password:', error);
            return null;
        }
    }
    
    /**
     * Ensures at least one admin user exists
     * Creates default admin if no users exist
     */
    function ensureAdminExists() {
        try {
            const usersData = localStorage.getItem(USERS_KEY);
            const users = usersData ? JSON.parse(usersData) : [];
            
            // Check if any admin exists
            const hasAdmin = users.some(user => user.role === 'admin');
            
            if (!hasAdmin) {
                console.log('No admin user found. Creating default admin...');
                const success = createUser(
                    DEFAULT_ADMIN.username, 
                    DEFAULT_ADMIN.password, 
                    DEFAULT_ADMIN.role
                );
                
                if (success) {
                    console.log('Default admin created successfully');
                    console.log(`Username: ${DEFAULT_ADMIN.username}`);
                    console.log(`Password: ${DEFAULT_ADMIN.password}`);
                    console.log('IMPORTANT: Please change this password immediately!');
                    
                    return {
                        username: DEFAULT_ADMIN.username,
                        password: DEFAULT_ADMIN.password,
                        isNewAdmin: true
                    };
                }
            }
            
            return null;
        } catch (error) {
            console.error('Failed to ensure admin exists:', error);
            return null;
        }
    }
    
    /**
     * Changes a user's password
     * @param {string} username - Username
     * @param {string} oldPassword - Current password
     * @param {string} newPassword - New password
     * @returns {boolean} True if successful, false otherwise
     */
    function changePassword(username, oldPassword, newPassword) {
        try {
            // Verify old password first
            const user = verifyPassword(username, oldPassword);
            if (!user) {
                console.error('Invalid current password');
                return false;
            }
            
            if (newPassword.length < 6) {
                console.error('New password must be at least 6 characters long');
                return false;
            }
            
            // Get user data
            const usersData = localStorage.getItem(USERS_KEY);
            const users = JSON.parse(usersData);
            const userIndex = users.findIndex(u => u.username === username);
            
            if (userIndex === -1) {
                return false;
            }
            
            // Hash new password
            const salt = bcrypt.genSaltSync(10);
            const hashedPassword = bcrypt.hashSync(newPassword, salt);
            
            // Update password
            users[userIndex].passwordHash = hashedPassword;
            localStorage.setItem(USERS_KEY, JSON.stringify(users));
            
            console.log(`Password changed successfully for user '${username}'`);
            return true;
        } catch (error) {
            console.error('Failed to change password:', error);
            return false;
        }
    }
    
    // Public API
    return {
        init,
        getAllUsers,
        getUser,
        createUser,
        deleteUser,
        verifyPassword,
        ensureAdminExists,
        changePassword
    };
})();

// Initialize user system when script loads
if (typeof window !== 'undefined') {
    window.Users = Users;
    // Initialize on load
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => Users.init());
    } else {
        Users.init();
    }
}
