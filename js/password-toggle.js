/**
 * Password Toggle Functionality
 * Handles show/hide password functionality for input fields
 */

(function() {
    'use strict';
    
    /**
     * Initialize password toggle functionality
     */
    function initPasswordToggles() {
        const passwordFields = document.querySelectorAll('input[type="password"]');
        
        passwordFields.forEach(field => {
            // Skip if already wrapped
            if (field.parentElement.classList.contains('password-input-wrapper')) {
                return;
            }
            
            wrapPasswordField(field);
        });
    }
    
    /**
     * Wrap a password field with toggle button
     */
    function wrapPasswordField(passwordInput) {
        // Create wrapper
        const wrapper = document.createElement('div');
        wrapper.className = 'password-input-wrapper';
        
        // Create toggle button
        const toggleButton = document.createElement('button');
        toggleButton.type = 'button';
        toggleButton.className = 'password-toggle-btn';
        toggleButton.setAttribute('aria-label', 'Passwort anzeigen');
        
        // Create icon
        const icon = document.createElement('i');
        icon.setAttribute('data-lucide', 'eye');
        toggleButton.appendChild(icon);
        
        // Wrap the input
        passwordInput.parentNode.insertBefore(wrapper, passwordInput);
        wrapper.appendChild(passwordInput);
        wrapper.appendChild(toggleButton);
        
        // Initialize Lucide icons for the new icon
        if (window.lucide) {
            window.lucide.createIcons();
        }
        
        // Add click event
        toggleButton.addEventListener('click', function() {
            togglePasswordVisibility(passwordInput, toggleButton);
        });
    }
    
    /**
     * Toggle password visibility
     */
    function togglePasswordVisibility(passwordInput, toggleButton) {
        const icon = toggleButton.querySelector('i');
        
        if (passwordInput.type === 'password') {
            passwordInput.type = 'text';
            icon.setAttribute('data-lucide', 'eye-off');
            toggleButton.setAttribute('aria-label', 'Passwort verbergen');
        } else {
            passwordInput.type = 'password';
            icon.setAttribute('data-lucide', 'eye');
            toggleButton.setAttribute('aria-label', 'Passwort anzeigen');
        }
        
        // Reinitialize Lucide icons
        if (window.lucide) {
            window.lucide.createIcons();
        }
    }
    
    /**
     * Reinitialize for dynamically added fields
     */
    function reinitialize() {
        initPasswordToggles();
    }
    
    // Initialize on DOM load
    document.addEventListener('DOMContentLoaded', function() {
        initPasswordToggles();
    });
    
    // Export for use in other scripts
    window.PasswordToggle = {
        init: initPasswordToggles,
        reinit: reinitialize
    };
})();
