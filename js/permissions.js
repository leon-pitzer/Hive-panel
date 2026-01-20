/**
 * Client-side Permission Utilities
 * Handles permission checking on the frontend
 */

const Permissions = (function() {
    'use strict';
    
    let currentUser = null;
    
    /**
     * Sets the current user with their permissions
     * @param {Object} user - User object with permissions and roles
     */
    function setCurrentUser(user) {
        currentUser = user;
    }
    
    /**
     * Gets the current user
     * @returns {Object|null} Current user object
     */
    function getCurrentUser() {
        return currentUser;
    }
    
    /**
     * Checks if user has wildcard permission OR is superadmin
     * @returns {boolean} True if user has wildcard or is superadmin
     */
    function hasWildcard() {
        if (!currentUser) return false;
        
        // Check if superadmin
        if (currentUser.role === 'superadmin') return true;
        
        // Check if has admin_all
        if (currentUser.permissions && currentUser.permissions.includes('admin_all')) return true;
        
        // Check wildcard (legacy)
        if (currentUser.permissions && currentUser.permissions.includes('*')) return true;
        
        return false;
    }
    
    /**
     * Checks if user has a specific permission
     * NOTE: Wildcard permission (*), admin_all, and superadmin role always return true
     * @param {string} permission - Permission to check
     * @returns {boolean} True if user has permission
     */
    function hasPermission(permission) {
        if (!currentUser) {
            return false;
        }
        
        // Superadmin and admin_all have everything
        if (hasWildcard()) {
            return true;
        }
        
        // Check direct permissions
        if (currentUser.permissions && currentUser.permissions.includes(permission)) {
            return true;
        }
        
        // Note: Role-based permissions are resolved on the server
        // The client receives the effective permissions list (including wildcard from roles)
        return false;
    }
    
    /**
     * Checks if user has any of the given permissions
     * @param {string[]} permissions - Array of permissions to check
     * @returns {boolean} True if user has any permission
     */
    function hasAnyPermission(permissions) {
        if (!permissions || !Array.isArray(permissions)) {
            return false;
        }
        
        if (hasWildcard()) {
            return true;
        }
        
        return permissions.some(perm => hasPermission(perm));
    }
    
    /**
     * Checks if user has all of the given permissions
     * @param {string[]} permissions - Array of permissions to check
     * @returns {boolean} True if user has all permissions
     */
    function hasAllPermissions(permissions) {
        if (!permissions || !Array.isArray(permissions)) {
            return false;
        }
        
        if (hasWildcard()) {
            return true;
        }
        
        return permissions.every(perm => hasPermission(perm));
    }
    
    /**
     * Shows or hides elements based on permission
     * @param {string} selector - CSS selector for elements
     * @param {string|string[]} requiredPermissions - Permission(s) required to show element
     */
    function toggleElements(selector, requiredPermissions) {
        const elements = document.querySelectorAll(selector);
        const perms = Array.isArray(requiredPermissions) ? requiredPermissions : [requiredPermissions];
        const hasAccess = hasAnyPermission(perms);
        
        elements.forEach(el => {
            if (hasAccess) {
                el.style.display = '';
                el.removeAttribute('data-permission-hidden');
            } else {
                el.style.display = 'none';
                el.setAttribute('data-permission-hidden', 'true');
            }
        });
    }
    
    /**
     * Initializes permission-based UI elements
     * Call this after user authentication to show/hide UI elements based on permissions
     */
    function initializeUI() {
        // Find all elements with data-permission attribute
        const permissionElements = document.querySelectorAll('[data-permission]');
        
        permissionElements.forEach(el => {
            const requiredPermission = el.getAttribute('data-permission');
            const requiresAll = el.hasAttribute('data-permission-all');
            const permissions = requiredPermission.split(',').map(p => p.trim());
            
            let hasAccess = false;
            
            if (requiresAll) {
                hasAccess = hasAllPermissions(permissions);
            } else {
                hasAccess = hasAnyPermission(permissions);
            }
            
            if (!hasAccess) {
                el.style.display = 'none';
                el.setAttribute('data-permission-hidden', 'true');
            } else {
                el.style.display = '';
                el.removeAttribute('data-permission-hidden');
            }
        });
    }
    
    // Public API
    return {
        setCurrentUser,
        getCurrentUser,
        hasWildcard,
        hasPermission,
        hasAnyPermission,
        hasAllPermissions,
        toggleElements,
        initializeUI
    };
})();

// Make Permissions available globally
if (typeof window !== 'undefined') {
    window.Permissions = Permissions;
}
