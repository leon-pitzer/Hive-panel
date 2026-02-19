/**
 * Global Error Handler
 * Catches unhandled errors and provides user feedback
 */

(function() {
    'use strict';
    
    // Configuration
    const TOAST_DURATION_MS = 3000; // Duration to show toast messages
    
    // Handle unhandled promise rejections
    window.addEventListener('unhandledrejection', function(event) {
        console.error('Unhandled promise rejection:', event.reason);
        
        // Show user-friendly error message
        if (typeof showToast === 'function') {
            showToast('Ein unerwarteter Fehler ist aufgetreten', 'error');
        }
        
        // Prevent default browser error handling
        event.preventDefault();
    });
    
    // Handle global errors
    window.addEventListener('error', function(event) {
        console.error('Global error:', event.error);
        
        // Show user-friendly error message for critical errors
        if (event.error && event.error.message) {
            const message = event.error.message.toLowerCase();
            if (message.includes('network') || message.includes('fetch')) {
                if (typeof showToast === 'function') {
                    showToast('Netzwerkfehler - Bitte Verbindung prüfen', 'error');
                }
            }
        }
    });
    
    /**
     * Global toast function for error messages
     */
    window.showToast = function(message, type = 'info') {
        const toast = document.getElementById('toast');
        if (toast) {
            toast.textContent = message;
            toast.className = 'toast toast-' + type + ' show';
            
            setTimeout(() => {
                toast.classList.remove('show');
            }, TOAST_DURATION_MS);
        } else {
            // Fallback to console if toast doesn't exist
            console.log(`[${type.toUpperCase()}] ${message}`);
        }
    };
})();
