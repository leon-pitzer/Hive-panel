/**
 * Auth.js - Session Management & Authentication
 * Handles user sessions, authentication state, and session security
 */

const Auth = (function() {
    'use strict';
    
    const SESSION_CHECK_INTERVAL = 60 * 1000; // Check every minute
    let sessionCheckTimer = null;
    
    /**
     * Checks authentication status with server
     * @returns {Promise<Object>} Auth status { authenticated: boolean, user?: Object }
     */
    async function checkAuthStatus() {
        try {
            const response = await fetch('/api/auth/status', {
                method: 'GET',
                credentials: 'same-origin'
            });
            
            if (!response.ok) {
                return { authenticated: false };
            }
            
            const data = await response.json();
            return data;
        } catch (error) {
            console.error('Error checking auth status:', error);
            return { authenticated: false };
        }
    }
    
    /**
     * Checks if user is authenticated
     * @returns {Promise<boolean>} True if authenticated, false otherwise
     */
    async function isAuthenticated() {
        const status = await checkAuthStatus();
        return status.authenticated;
    }
    
    /**
     * Logs out the current user
     * @returns {Promise<boolean>} Success status
     */
    async function logout() {
        try {
            const response = await fetch('/api/auth/logout', {
                method: 'POST',
                credentials: 'same-origin'
            });
            
            if (response.ok) {
                // Stop session check timer
                if (sessionCheckTimer) {
                    clearInterval(sessionCheckTimer);
                    sessionCheckTimer = null;
                }
                
                // Redirect to login page
                window.location.href = '/';
                return true;
            }
            
            return false;
        } catch (error) {
            console.error('Logout error:', error);
            return false;
        }
    }
    
    /**
     * Starts periodic session validation
     * Checks if session is still valid and redirects to login if not
     */
    function startSessionValidation() {
        // Clear any existing timer
        if (sessionCheckTimer) {
            clearInterval(sessionCheckTimer);
        }
        
        // Check session periodically
        sessionCheckTimer = setInterval(async () => {
            const status = await checkAuthStatus();
            
            if (!status.authenticated) {
                // Session expired, redirect to login
                clearInterval(sessionCheckTimer);
                sessionCheckTimer = null;
                
                // Show message and redirect
                alert('Ihre Sitzung ist abgelaufen. Bitte melden Sie sich erneut an.');
                window.location.href = '/';
            }
        }, SESSION_CHECK_INTERVAL);
    }
    
    /**
     * Stops session validation
     */
    function stopSessionValidation() {
        if (sessionCheckTimer) {
            clearInterval(sessionCheckTimer);
            sessionCheckTimer = null;
        }
    }
    
    /**
     * Gets the current user info from server
     * @returns {Promise<Object|null>} User object or null
     */
    async function getCurrentUser() {
        const status = await checkAuthStatus();
        return status.authenticated ? status.user : null;
    }
    
    // Public API
    return {
        checkAuthStatus,
        isAuthenticated,
        logout,
        startSessionValidation,
        stopSessionValidation,
        getCurrentUser
    };
})();

// Make Auth available globally
if (typeof window !== 'undefined') {
    window.Auth = Auth;
}
