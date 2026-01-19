/**
 * Permission utilities
 * Helper functions for checking user permissions and roles
 */

const path = require('path');
const { readJsonFile } = require('./fileOperations');
const { logger } = require('./logger');

const ROLES_FILE = path.join(__dirname, '../../data/roles.json');

/**
 * Checks if user has wildcard permission
 * @param {Object} user - User object
 * @returns {boolean} True if user has wildcard permission
 */
function hasWildcard(user) {
    if (!user || !user.permissions) {
        return false;
    }
    return user.permissions.includes('*');
}

/**
 * Gets all permissions for a role
 * @param {string} roleId - Role ID
 * @returns {Promise<string[]>} Array of permissions
 */
async function getRolePermissions(roleId) {
    try {
        // TODO: Replace with MySQL query in future
        // SELECT permissions FROM roles WHERE id = ?
        const rolesData = await readJsonFile(ROLES_FILE, { roles: [] });
        const role = rolesData.roles.find(r => r.id === roleId);
        return role ? role.permissions : [];
    } catch (error) {
        logger.error('Error getting role permissions:', { error: error.message, roleId });
        return [];
    }
}

/**
 * Gets all permissions for a user (direct + inherited from roles)
 * @param {Object} user - User object
 * @returns {Promise<string[]>} Array of all user permissions
 */
async function getAllUserPermissions(user) {
    if (!user) {
        return [];
    }

    // Start with direct permissions
    const permissions = new Set(user.permissions || []);

    // Check for wildcard
    if (permissions.has('*')) {
        return ['*'];
    }

    // Add permissions from roles
    if (user.roles && Array.isArray(user.roles)) {
        for (const roleId of user.roles) {
            const rolePermissions = await getRolePermissions(roleId);
            rolePermissions.forEach(perm => permissions.add(perm));
            
            // If role has wildcard, return immediately
            if (permissions.has('*')) {
                return ['*'];
            }
        }
    }

    return Array.from(permissions);
}

/**
 * Checks if user has a specific permission
 * @param {Object} user - User object
 * @param {string} permission - Permission to check
 * @returns {Promise<boolean>} True if user has permission
 */
async function hasPermission(user, permission) {
    if (!user || !permission) {
        return false;
    }

    // Check for wildcard first
    if (hasWildcard(user)) {
        return true;
    }

    // Get all user permissions
    const allPermissions = await getAllUserPermissions(user);

    // Check if permission exists
    return allPermissions.includes(permission);
}

/**
 * Checks if user has any of the given permissions
 * @param {Object} user - User object
 * @param {string[]} permissions - Array of permissions to check
 * @returns {Promise<boolean>} True if user has any of the permissions
 */
async function hasAnyPermission(user, permissions) {
    if (!user || !permissions || !Array.isArray(permissions)) {
        return false;
    }

    // Check for wildcard first
    if (hasWildcard(user)) {
        return true;
    }

    // Check each permission
    for (const permission of permissions) {
        if (await hasPermission(user, permission)) {
            return true;
        }
    }

    return false;
}

/**
 * Checks if user has all of the given permissions
 * @param {Object} user - User object
 * @param {string[]} permissions - Array of permissions to check
 * @returns {Promise<boolean>} True if user has all permissions
 */
async function hasAllPermissions(user, permissions) {
    if (!user || !permissions || !Array.isArray(permissions)) {
        return false;
    }

    // Check for wildcard first
    if (hasWildcard(user)) {
        return true;
    }

    // Check each permission
    for (const permission of permissions) {
        if (!(await hasPermission(user, permission))) {
            return false;
        }
    }

    return true;
}

/**
 * Gets a role by ID
 * @param {string} roleId - Role ID
 * @returns {Promise<Object|null>} Role object or null
 */
async function getRoleById(roleId) {
    try {
        // TODO: Replace with MySQL query in future
        // SELECT * FROM roles WHERE id = ?
        const rolesData = await readJsonFile(ROLES_FILE, { roles: [] });
        return rolesData.roles.find(r => r.id === roleId) || null;
    } catch (error) {
        logger.error('Error getting role by ID:', { error: error.message, roleId });
        return null;
    }
}

/**
 * Gets all roles
 * @returns {Promise<Object[]>} Array of roles
 */
async function getAllRoles() {
    try {
        // TODO: Replace with MySQL query in future
        // SELECT * FROM roles ORDER BY name
        const rolesData = await readJsonFile(ROLES_FILE, { roles: [] });
        return rolesData.roles;
    } catch (error) {
        logger.error('Error getting all roles:', { error: error.message });
        return [];
    }
}

module.exports = {
    hasWildcard,
    hasPermission,
    hasAnyPermission,
    hasAllPermissions,
    getAllUserPermissions,
    getRoleById,
    getRolePermissions,
    getAllRoles
};
