/**
 * Sidebar Toggle Functionality
 * Handles sidebar expand/collapse with localStorage persistence
 */

(function() {
    'use strict';
    
    const SIDEBAR_STATE_KEY = 'hive-panel-sidebar-collapsed';
    
    // Initialize sidebar on DOM load
    document.addEventListener('DOMContentLoaded', function() {
        const sidebar = document.getElementById('sidebar');
        const sidebarToggle = document.getElementById('sidebar-toggle');
        const mobileMenuToggle = document.getElementById('mobile-menu-toggle');
        const sidebarOverlay = document.getElementById('sidebar-overlay');
        
        if (!sidebar) return;
        
        // Restore sidebar state from localStorage
        const isCollapsed = localStorage.getItem(SIDEBAR_STATE_KEY) === 'true';
        if (isCollapsed && window.innerWidth > 768) {
            sidebar.classList.add('collapsed');
            updateToggleIcon(true);
        }
        
        // Desktop toggle
        if (sidebarToggle) {
            sidebarToggle.addEventListener('click', function() {
                toggleSidebar();
            });
        }
        
        // Mobile menu toggle
        if (mobileMenuToggle) {
            mobileMenuToggle.addEventListener('click', function() {
                sidebar.classList.add('mobile-open');
                sidebarOverlay.classList.add('active');
            });
        }
        
        // Overlay click (mobile)
        if (sidebarOverlay) {
            sidebarOverlay.addEventListener('click', function() {
                closeMobileSidebar();
            });
        }
        
        // Handle window resize
        let resizeTimeout;
        window.addEventListener('resize', function() {
            clearTimeout(resizeTimeout);
            resizeTimeout = setTimeout(function() {
                if (window.innerWidth > 768) {
                    closeMobileSidebar();
                }
            }, 250);
        });
        
        // Close mobile sidebar when clicking nav items
        const sidebarItems = sidebar.querySelectorAll('.sidebar-item');
        sidebarItems.forEach(item => {
            item.addEventListener('click', function() {
                if (window.innerWidth <= 768) {
                    closeMobileSidebar();
                }
            });
        });
        
        // Account button navigation
        const accountButton = document.getElementById('sidebar-account-button');
        if (accountButton) {
            accountButton.addEventListener('click', function() {
                window.location.href = '/html/account.html';
            });
        }
    });
    
    /**
     * Toggle sidebar collapsed state
     */
    function toggleSidebar() {
        const sidebar = document.getElementById('sidebar');
        const isCurrentlyCollapsed = sidebar.classList.contains('collapsed');
        
        if (isCurrentlyCollapsed) {
            sidebar.classList.remove('collapsed');
            localStorage.setItem(SIDEBAR_STATE_KEY, 'false');
            updateToggleIcon(false);
        } else {
            sidebar.classList.add('collapsed');
            localStorage.setItem(SIDEBAR_STATE_KEY, 'true');
            updateToggleIcon(true);
        }
    }
    
    /**
     * Close mobile sidebar
     */
    function closeMobileSidebar() {
        const sidebar = document.getElementById('sidebar');
        const sidebarOverlay = document.getElementById('sidebar-overlay');
        
        if (sidebar) {
            sidebar.classList.remove('mobile-open');
        }
        if (sidebarOverlay) {
            sidebarOverlay.classList.remove('active');
        }
    }
    
    /**
     * Update toggle button icon
     */
    function updateToggleIcon(isCollapsed) {
        const toggleButton = document.getElementById('sidebar-toggle');
        if (!toggleButton) return;
        
        const icon = toggleButton.querySelector('i');
        if (icon) {
            icon.setAttribute('data-lucide', isCollapsed ? 'panel-left-open' : 'panel-left-close');
            // Reinitialize Lucide icons
            if (window.lucide) {
                window.lucide.createIcons();
            }
        }
    }
})();
