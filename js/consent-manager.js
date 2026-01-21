/**
 * Cookie Banner Functionality
 * Shows a cookie acceptance banner on first visit with blocking overlay on rejection
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
     * Accept cookies and hide banner/overlay
     */
    function acceptCookies() {
        localStorage.setItem(COOKIE_CONSENT_KEY, 'true');
        hideBanner();
        hideBlockerOverlay();
    }
    
    /**
     * Reject cookies and show blocker overlay
     */
    function rejectCookies() {
        hideBanner();
        showBlockerOverlay();
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
     * Show blocker overlay
     */
    function showBlockerOverlay() {
        const overlay = document.getElementById('cookie-blocker-overlay');
        if (overlay) {
            overlay.style.display = 'flex';
            // Disable all form inputs and buttons
            disablePageInteraction();
        }
    }
    
    /**
     * Hide blocker overlay
     */
    function hideBlockerOverlay() {
        const overlay = document.getElementById('cookie-blocker-overlay');
        if (overlay) {
            overlay.style.display = 'none';
            // Re-enable form inputs and buttons
            enablePageInteraction();
        }
    }
    
    /**
     * Disable page interaction
     */
    function disablePageInteraction() {
        // Disable all inputs and buttons except overlay buttons
        const inputs = document.querySelectorAll('input, button, textarea, select, a');
        inputs.forEach(element => {
            // Skip overlay buttons
            if (element.id === 'cookie-blocker-accept-btn' || element.closest('#cookie-blocker-overlay')) {
                return;
            }
            element.setAttribute('data-cookie-disabled', 'true');
            element.disabled = true;
            element.style.pointerEvents = 'none';
        });
    }
    
    /**
     * Enable page interaction
     */
    function enablePageInteraction() {
        const inputs = document.querySelectorAll('[data-cookie-disabled]');
        inputs.forEach(element => {
            element.removeAttribute('data-cookie-disabled');
            element.disabled = false;
            element.style.pointerEvents = '';
        });
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
        
        // Setup reject button
        const rejectButton = document.getElementById('cookie-reject-btn');
        if (rejectButton) {
            rejectButton.addEventListener('click', rejectCookies);
        }
        
        // Setup blocker overlay accept button
        const blockerAcceptButton = document.getElementById('cookie-blocker-accept-btn');
        if (blockerAcceptButton) {
            blockerAcceptButton.addEventListener('click', acceptCookies);
        }
    }
    
    // Initialize on DOM load
    document.addEventListener('DOMContentLoaded', initCookieBanner);
    
    // Export functions for use in other scripts
    window.CookieBanner = {
        init: initCookieBanner,
        accept: acceptCookies,
        reject: rejectCookies,
        hasAccepted: hasAcceptedCookies
    };
})();
