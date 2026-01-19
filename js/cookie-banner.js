/**
 * Cookie Banner Functionality
 * Shows a cookie acceptance banner on first visit
 */

(function() {
    'use strict';
    
    const COOKIE_CONSENT_KEY = 'hive-panel-cookie-consent';
    
    /**
     * Check if user has already accepted cookies
     */
    function hasAcceptedCookies() {
        return localStorage.getItem(COOKIE_CONSENT_KEY) === 'true';
    }
    
    /**
     * Accept cookies and hide banner
     */
    function acceptCookies() {
        localStorage.setItem(COOKIE_CONSENT_KEY, 'true');
        hideBanner();
    }
    
    /**
     * Show cookie banner
     */
    function showBanner() {
        const banner = document.getElementById('cookie-banner');
        if (banner) {
            banner.classList.add('show');
        }
    }
    
    /**
     * Hide cookie banner
     */
    function hideBanner() {
        const banner = document.getElementById('cookie-banner');
        if (banner) {
            banner.classList.remove('show');
        }
    }
    
    /**
     * Initialize cookie banner on page load
     */
    function initCookieBanner() {
        // If user hasn't accepted cookies, show banner
        if (!hasAcceptedCookies()) {
            // Show banner after a short delay to avoid blocking page load
            setTimeout(showBanner, 500);
        }
        
        // Setup accept button
        const acceptButton = document.getElementById('cookie-accept-btn');
        if (acceptButton) {
            acceptButton.addEventListener('click', acceptCookies);
        }
    }
    
    // Initialize on DOM load
    document.addEventListener('DOMContentLoaded', initCookieBanner);
    
    // Export functions for use in other scripts
    window.CookieBanner = {
        init: initCookieBanner,
        accept: acceptCookies,
        hasAccepted: hasAcceptedCookies
    };
})();
