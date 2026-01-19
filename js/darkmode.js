/**
 * Dark Mode Functionality
 * Handles dark mode toggle with localStorage persistence
 */

(function() {
    'use strict';
    
    const DARK_MODE_KEY = 'hive-panel-dark-mode';
    
    /**
     * Initialize dark mode on page load
     */
    function initDarkMode() {
        const isDarkMode = localStorage.getItem(DARK_MODE_KEY) === 'true';
        applyDarkMode(isDarkMode);
    }
    
    /**
     * Apply dark mode to the document
     */
    function applyDarkMode(isDark) {
        if (isDark) {
            document.documentElement.setAttribute('data-theme', 'dark');
        } else {
            document.documentElement.removeAttribute('data-theme');
        }
        updateToggleButton(isDark);
    }
    
    /**
     * Toggle dark mode on/off
     */
    function toggleDarkMode() {
        const currentMode = document.documentElement.getAttribute('data-theme') === 'dark';
        const newMode = !currentMode;
        
        localStorage.setItem(DARK_MODE_KEY, newMode.toString());
        applyDarkMode(newMode);
        
        // Show toast notification
        showToast(newMode ? 'Dark Mode aktiviert' : 'Light Mode aktiviert', 'success');
    }
    
    /**
     * Update toggle button appearance
     */
    function updateToggleButton(isDark) {
        const toggleButton = document.getElementById('dark-mode-toggle');
        if (!toggleButton) return;
        
        const icon = toggleButton.querySelector('i');
        const text = toggleButton.querySelector('.toggle-text');
        
        if (icon) {
            icon.setAttribute('data-lucide', isDark ? 'sun' : 'moon');
            if (window.lucide) {
                window.lucide.createIcons();
            }
        }
        
        if (text) {
            text.textContent = isDark ? 'Light Mode' : 'Dark Mode';
        }
    }
    
    /**
     * Show toast notification
     */
    function showToast(message, type = 'info') {
        const toast = document.getElementById('toast');
        if (!toast) return;
        
        toast.textContent = message;
        toast.className = 'toast toast-' + type + ' show';
        
        setTimeout(() => {
            toast.classList.remove('show');
        }, 3000);
    }
    
    /**
     * Check if dark mode is enabled
     */
    function isDarkModeEnabled() {
        return document.documentElement.getAttribute('data-theme') === 'dark';
    }
    
    // Initialize on DOM load
    document.addEventListener('DOMContentLoaded', function() {
        initDarkMode();
        
        // Setup toggle button if it exists
        const toggleButton = document.getElementById('dark-mode-toggle');
        if (toggleButton) {
            toggleButton.addEventListener('click', toggleDarkMode);
        }
    });
    
    // Export functions for use in other scripts
    window.DarkMode = {
        init: initDarkMode,
        toggle: toggleDarkMode,
        isEnabled: isDarkModeEnabled,
        apply: applyDarkMode
    };
})();
