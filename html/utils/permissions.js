/**
 * Permission utilities
 * Helper functions for checking user permissions and roles
 */

const path = require('path');
const { readJsonFile } = require('./fileOperations');
const { logger } = require('./logger');

const ROLES_FILE = path.join(__dirname, '../../data/roles.json');

// Role definitions
const ROLES = {
    SUPERADMIN: 'superadmin',
    ADMIN: 'admin',
    USER: 'user'
};

// Permission definitions
const PERMISSIONS = {
    MANAGE_ACCOUNTS: 'manage_accounts',
    VIEW_ACCOUNTS: 'view_accounts',
    MANAGE_ROLES: 'manage_roles',
    HANDLE_REQUESTS: 'handle_requests',
    ADMIN_ALL: 'admin_all'  // For legacy admin role
};

/**
 * Check if user is superadmin
 * Superadmins have ALL permissions automatically
 * @param {Object} user - User object
 * @returns {boolean} True if user is superadmin
 */
function isSuperAdmin(user) {
    return user && user.role === ROLES.SUPERADMIN;
}

/**
 * Check if user has admin_all permission (legacy admin)
 * @param {Object} user - User object
 * @returns {boolean} True if user has admin_all permission
 */
function isUserAdmin(user) {
    return user && user.permissions && user.permissions.includes(PERMISSIONS.ADMIN_ALL);
}

/**
 * Checks if user has wildcard permission (legacy)
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

    // Superadmin gets all permissions
    if (isSuperAdmin(user)) {
        return Object.values(PERMISSIONS);
    }

    // Admin with admin_all gets all permissions
    if (isUserAdmin(user)) {
        return Object.values(PERMISSIONS);
    }

    // Check for wildcard (legacy)
    if (hasWildcard(user)) {
        return Object.values(PERMISSIONS);
    }

    // Start with direct permissions
    const permissions = new Set(user.permissions || []);

    // Add permissions from roles
    if (user.roles && Array.isArray(user.roles)) {
        for (const roleId of user.roles) {
            const rolePermissions = await getRolePermissions(roleId);
            rolePermissions.forEach(perm => permissions.add(perm));
            
            // If role has wildcard or admin_all, return all permissions
            if (permissions.has('*') || permissions.has(PERMISSIONS.ADMIN_ALL)) {
                return Object.values(PERMISSIONS);
            }
        }
    }

    return Array.from(permissions);
}

/**
 * Checks if user has a specific permission
 * Returns true if:
 * - User is superadmin
 * - User has admin_all permission
 * - User has the specific permission
 * @param {Object} user - User object
 * @param {string} permission - Permission to check
 * @returns {Promise<boolean>} True if user has permission
 */
async function hasPermission(user, permission) {
    if (!user || !permission) {
        return false;
    }

    // Superadmin always has all permissions
    if (isSuperAdmin(user)) {
        return true;
    }

    // User with admin_all has all permissions
    if (isUserAdmin(user)) {
        return true;
    }

    // Check for wildcard first (legacy)
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

    // Superadmin always has all permissions
    if (isSuperAdmin(user)) {
        return true;
    }

    // User with admin_all has all permissions
    if (isUserAdmin(user)) {
        return true;
    }

    // Check for wildcard first (legacy)
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

    // Superadmin always has all permissions
    if (isSuperAdmin(user)) {
        return true;
    }

    // User with admin_all has all permissions
    if (isUserAdmin(user)) {
        return true;
    }

    // Check for wildcard first (legacy)
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
    ROLES,
    PERMISSIONS,
    isSuperAdmin,
    isUserAdmin,
    hasWildcard,
    hasPermission,
    hasAnyPermission,
    hasAllPermissions,
    getAllUserPermissions,
    getRoleById,
    getRolePermissions,
    getAllRoles
};
