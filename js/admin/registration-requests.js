/**
 * Registration Requests Management
 * Handles viewing and managing registration requests
 */

(function() {
    'use strict';
    
    let csrfToken = null;
    let registrationRequests = [];
    let currentRejectId = null;
    
    // Initialize on DOM load
    document.addEventListener('DOMContentLoaded', async function() {
        // Get CSRF token
        csrfToken = await getCsrfToken();
        
        // Setup reject modal
        setupRejectModal();
        
        // Load registration requests
        await loadRegistrationRequests();
    });
    
    /**
     * Get CSRF token from server
     */
    async function getCsrfToken() {
        try {
            const response = await fetch('/api/csrf-token', {
                credentials: 'same-origin'
            });
            const data = await response.json();
            return data.csrfToken;
        } catch (error) {
            console.error('Failed to get CSRF token:', error);
            return null;
        }
    }
    
    /**
     * Load registration requests from server
     */
    async function loadRegistrationRequests() {
        try {
            const response = await fetch('/api/admin/registration-requests', {
                credentials: 'same-origin'
            });
            
            if (!response.ok) {
                throw new Error('Failed to load registration requests');
            }
            
            const data = await response.json();
            registrationRequests = data.requests || [];
            
            renderRegistrationRequests();
            updatePendingBadge();
        } catch (error) {
            console.error('Error loading registration requests:', error);
            showToast('Fehler beim Laden der Registrierungsanfragen', 'error');
        }
    }
    
    /**
     * Render registration requests table
     */
    function renderRegistrationRequests() {
        const tbody = document.getElementById('registration-requests-tbody');
        
        if (!tbody) return;
        
        if (registrationRequests.length === 0) {
            tbody.innerHTML = `
                <tr>
                    <td colspan="5" class="empty-state">
                        <i data-lucide="inbox"></i>
                        <p>Keine Registrierungsanfragen vorhanden</p>
                    </td>
                </tr>
            `;
            lucide.createIcons();
            return;
        }
        
        tbody.innerHTML = registrationRequests.map(request => {
            const statusClass = request.status === 'pending' ? 'badge-warning' : 'badge-danger';
            const statusText = request.status === 'pending' ? 'Ausstehend' : 'Abgelehnt';
            const date = new Date(request.createdAt).toLocaleString('de-DE');
            
            return `
                <tr>
                    <td>${escapeHtml(request.username)}</td>
                    <td>${escapeHtml(request.email)}</td>
                    <td><span class="badge ${statusClass}">${statusText}</span></td>
                    <td>${date}</td>
                    <td class="table-actions">
                        ${request.status === 'pending' ? `
                            <button class="btn-icon" onclick="registrationRequestsModule.approveRequest('${request.id}')" title="Genehmigen">
                                <i data-lucide="check"></i>
                            </button>
                            <button class="btn-icon btn-danger" onclick="registrationRequestsModule.openRejectModal('${request.id}')" title="Ablehnen">
                                <i data-lucide="x"></i>
                            </button>
                        ` : `
                            <span style="color: var(--text-secondary); font-size: 0.875rem;">Keine Aktionen</span>
                        `}
                    </td>
                </tr>
            `;
        }).join('');
        
        lucide.createIcons();
    }
    
    /**
     * Update pending badge count
     */
    function updatePendingBadge() {
        const pendingCount = registrationRequests.filter(r => r.status === 'pending').length;
        const badge = document.getElementById('registration-requests-badge');
        
        if (badge) {
            badge.textContent = pendingCount;
            badge.style.display = pendingCount > 0 ? 'inline' : 'none';
        }
    }
    
    /**
     * Approve registration request
     * @param {string} id - Request ID
     */
    async function approveRequest(id) {
        if (!confirm('Möchten Sie diese Registrierungsanfrage wirklich genehmigen?')) {
            return;
        }
        
        try {
            const response = await fetch(`/api/admin/registration-requests/${id}/approve`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'CSRF-Token': csrfToken
                },
                credentials: 'same-origin'
            });
            
            if (!response.ok) {
                const data = await response.json();
                throw new Error(data.error || 'Failed to approve request');
            }
            
            showToast('Registrierungsanfrage erfolgreich genehmigt', 'success');
            await loadRegistrationRequests();
        } catch (error) {
            console.error('Error approving request:', error);
            showToast('Fehler beim Genehmigen der Anfrage: ' + error.message, 'error');
        }
    }
    
    /**
     * Open reject modal
     * @param {string} id - Request ID
     */
    function openRejectModal(id) {
        currentRejectId = id;
        const modal = document.getElementById('reject-modal');
        const reasonInput = document.getElementById('reject-reason');
        
        if (modal) {
            modal.classList.add('show');
            if (reasonInput) {
                reasonInput.value = '';
                reasonInput.focus();
            }
        }
    }
    
    /**
     * Setup reject modal
     */
    function setupRejectModal() {
        const modal = document.getElementById('reject-modal');
        const closeButtons = document.querySelectorAll('[data-modal="reject-modal"]');
        const confirmButton = document.getElementById('reject-confirm-btn');
        
        // Close modal handlers
        closeButtons.forEach(button => {
            button.addEventListener('click', function() {
                modal.classList.remove('show');
                currentRejectId = null;
            });
        });
        
        // Click backdrop to close
        if (modal) {
            modal.addEventListener('click', function(e) {
                if (e.target.classList.contains('modal-backdrop')) {
                    modal.classList.remove('show');
                    currentRejectId = null;
                }
            });
        }
        
        // Confirm reject button
        if (confirmButton) {
            confirmButton.addEventListener('click', async function() {
                await rejectRequest();
            });
        }
    }
    
    /**
     * Reject registration request
     */
    async function rejectRequest() {
        if (!currentRejectId) return;
        
        const reasonInput = document.getElementById('reject-reason');
        const reason = reasonInput ? reasonInput.value.trim() : '';
        const modal = document.getElementById('reject-modal');
        
        try {
            const response = await fetch(`/api/admin/registration-requests/${currentRejectId}/reject`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'CSRF-Token': csrfToken
                },
                credentials: 'same-origin',
                body: JSON.stringify({ reason })
            });
            
            if (!response.ok) {
                const data = await response.json();
                throw new Error(data.error || 'Failed to reject request');
            }
            
            showToast('Registrierungsanfrage erfolgreich abgelehnt', 'success');
            modal.classList.remove('show');
            currentRejectId = null;
            await loadRegistrationRequests();
        } catch (error) {
            console.error('Error rejecting request:', error);
            showToast('Fehler beim Ablehnen der Anfrage: ' + error.message, 'error');
        }
    }
    
    /**
     * Show toast notification
     * @param {string} message - Toast message
     * @param {string} type - Toast type (success, error, warning, info)
     */
    function showToast(message, type = 'info') {
        const toast = document.getElementById('toast');
        if (!toast) return;
        
        toast.textContent = message;
        toast.className = 'toast show toast-' + type;
        
        setTimeout(() => {
            toast.classList.remove('show');
        }, 4000);
    }
    
    /**
     * Escape HTML to prevent XSS
     * @param {string} text - Text to escape
     * @returns {string} Escaped text
     */
    function escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }
    
    // Expose functions globally for onclick handlers
    window.registrationRequestsModule = {
        approveRequest,
        openRejectModal
    };
})();
