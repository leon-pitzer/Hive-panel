/**
 * Auth.js - Session Management & Authentication
 * Handles user sessions, authentication state, and session security
 */

const Auth = (function() {
    'use strict';
    
    const SESSION_KEY = 'hive_session';
    const SESSION_DURATION = 24 * 60 * 60 * 1000; // 24 hours in milliseconds
    
    /**
     * Creates a new user session
     * @param {string} username - Username
     * @param {string} role - User role
     * @returns {Object} Session object
     */
    function createSession(username, role = 'user') {
        const session = {
            username: username,
            role: role,
            loginTime: new Date().toISOString(),
            expiresAt: new Date(Date.now() + SESSION_DURATION).toISOString(),
            sessionId: generateSessionId()
        };
        
        try {
            localStorage.setItem(SESSION_KEY, JSON.stringify(session));
            return session;
        } catch (error) {
            console.error('Failed to create session:', error);
            return null;
        }
    }
    
    /**
     * Retrieves the current session
     * @returns {Object|null} Session object or null if no valid session
     */
    function getSession() {
        try {
            const sessionData = localStorage.getItem(SESSION_KEY);
            if (!sessionData) {
                return null;
            }
            
            const session = JSON.parse(sessionData);
            
            // Check if session has expired
            if (new Date(session.expiresAt) < new Date()) {
                logout();
                return null;
            }
            
            return session;
        } catch (error) {
            console.error('Failed to retrieve session:', error);
            return null;
        }
    }
    
    /**
     * Checks if user is authenticated
     * @returns {boolean} True if authenticated, false otherwise
     */
    function isAuthenticated() {
        const session = getSession();
        return session !== null;
    }
    
    /**
     * Logs out the current user
     */
    function logout() {
        try {
            localStorage.removeItem(SESSION_KEY);
        } catch (error) {
            console.error('Failed to logout:', error);
        }
    }
    
    /**
     * Generates a cryptographically secure random session ID
     * @returns {string} Random session ID
     */
    function generateSessionId() {
        // Use Web Crypto API for better security
        if (typeof crypto !== 'undefined' && crypto.getRandomValues) {
            const array = new Uint32Array(3);
            crypto.getRandomValues(array);
            return 'session_' + Array.from(array).map(n => n.toString(36)).join('_') + 
                   '_' + Date.now().toString(36);
        }
        // Fallback to Math.random() if crypto API not available
        return 'session_' + Math.random().toString(36).substr(2, 9) + 
               '_' + Date.now().toString(36);
    }
    
    /**
     * Gets the current username from session
     * @returns {string|null} Username or null
     */
    function getCurrentUsername() {
        const session = getSession();
        return session ? session.username : null;
    }
    
    /**
     * Gets the current user role from session
     * @returns {string|null} User role or null
     */
    function getCurrentUserRole() {
        const session = getSession();
        return session ? session.role : null;
    }
    
    /**
     * Extends the current session
     */
    function extendSession() {
        const session = getSession();
        if (session) {
            session.expiresAt = new Date(Date.now() + SESSION_DURATION).toISOString();
            try {
                localStorage.setItem(SESSION_KEY, JSON.stringify(session));
            } catch (error) {
                console.error('Failed to extend session:', error);
            }
        }
    }
    
    // Public API
    return {
        createSession,
        getSession,
        isAuthenticated,
        logout,
        getCurrentUsername,
        getCurrentUserRole,
        extendSession
    };
})();

// Make Auth available globally
if (typeof window !== 'undefined') {
    window.Auth = Auth;
}
