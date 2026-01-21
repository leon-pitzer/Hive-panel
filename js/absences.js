/**
 * Absences Management Frontend
 * Handles absence creation, viewing, and deletion
 */

const AbsencesManager = (function() {
    'use strict';
    
    let csrfToken = null;
    let initialized = false;
    let deleteCallback = null;
    
    /**
     * Initialize the absences manager
     */
    async function init() {
        if (initialized) return;
        initialized = true;
        
        // Get CSRF token
        csrfToken = await getCsrfToken();
        
        // Setup form and modal
        setupAbsenceForm();
        setupDeleteModal();
        
        // Load absences
        await loadMyAbsences();
        
        // Load all absences if user has permission
        if (typeof Permissions !== 'undefined' && 
            Permissions.hasAnyPermission(['view_absences', 'manage_absences', 'admin_all', '*'])) {
            await loadAllAbsences();
        }
        
        // Set minimum date on date inputs (3 days from now)
        setMinimumDates();
    }
    
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
     * Set minimum dates for date inputs (3 days from today)
     */
    function setMinimumDates() {
        const today = new Date();
        const minDate = new Date(today);
        minDate.setDate(minDate.getDate() + 3);
        
        const startDateInput = document.getElementById('start-date');
        const endDateInput = document.getElementById('end-date');
        
        const minDateString = minDate.toISOString().split('T')[0];
        
        if (startDateInput) {
            startDateInput.setAttribute('min', minDateString);
        }
        
        if (endDateInput) {
            endDateInput.setAttribute('min', minDateString);
        }
        
        // Update end date minimum when start date changes
        if (startDateInput && endDateInput) {
            startDateInput.addEventListener('change', function() {
                if (this.value) {
                    const selectedStart = new Date(this.value);
                    const minEnd = new Date(selectedStart);
                    minEnd.setDate(minEnd.getDate() + 3);
                    endDateInput.setAttribute('min', minEnd.toISOString().split('T')[0]);
                }
            });
        }
    }
    
    /**
     * Setup absence creation form
     */
    function setupAbsenceForm() {
        const form = document.getElementById('absence-form');
        if (!form) return;
        
        form.addEventListener('submit', async function(e) {
            e.preventDefault();
            
            const startDate = document.getElementById('start-date').value;
            const endDate = document.getElementById('end-date').value;
            const startTime = document.getElementById('start-time').value || null;
            const endTime = document.getElementById('end-time').value || null;
            const reason = document.getElementById('reason').value.trim();
            
            if (!startDate || !endDate || !reason) {
                showToast('Bitte füllen Sie alle Pflichtfelder aus', 'error');
                return;
            }
            
            // Validate dates client-side
            const start = new Date(startDate);
            const end = new Date(endDate);
            const today = new Date();
            today.setHours(0, 0, 0, 0);
            
            const threeDaysFromNow = new Date(today);
            threeDaysFromNow.setDate(threeDaysFromNow.getDate() + 3);
            
            if (start < threeDaysFromNow) {
                showToast('Abwesenheit muss mindestens 3 Tage im Voraus angemeldet werden', 'error');
                return;
            }
            
            if (end < start) {
                showToast('Enddatum muss nach dem Startdatum liegen', 'error');
                return;
            }
            
            const durationInDays = Math.floor((end - start) / (1000 * 60 * 60 * 24));
            if (durationInDays < 3) {
                showToast('Abwesenheit muss mindestens 3 Tage dauern', 'error');
                return;
            }
            
            const submitBtn = form.querySelector('button[type="submit"]');
            setButtonLoading(submitBtn, true);
            
            try {
                const response = await fetch('/api/absences', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'CSRF-Token': csrfToken
                    },
                    credentials: 'same-origin',
                    body: JSON.stringify({
                        startDate,
                        endDate,
                        startTime,
                        endTime,
                        reason
                    })
                });
                
                const data = await response.json();
                
                if (data.success) {
                    showToast(data.message || 'Abwesenheit erfolgreich erstellt', 'success');
                    form.reset();
                    
                    // Reload absences
                    await loadMyAbsences();
                    if (typeof Permissions !== 'undefined' && 
                        Permissions.hasAnyPermission(['view_absences', 'manage_absences', 'admin_all', '*'])) {
                        await loadAllAbsences();
                    }
                } else {
                    showToast(data.error || 'Fehler beim Erstellen der Abwesenheit', 'error');
                }
            } catch (error) {
                console.error('Error:', error);
                showToast('Netzwerkfehler beim Erstellen der Abwesenheit', 'error');
            } finally {
                setButtonLoading(submitBtn, false);
            }
        });
    }
    
    /**
     * Load user's own absences
     */
    async function loadMyAbsences() {
        try {
            const response = await fetch('/api/absences/my', {
                credentials: 'same-origin'
            });
            
            const data = await response.json();
            
            if (data.success && data.absences) {
                displayMyAbsences(data.absences);
            } else {
                throw new Error('Failed to load absences');
            }
        } catch (error) {
            console.error('Error loading absences:', error);
            const tbody = document.getElementById('my-absences-tbody');
            if (tbody) {
                tbody.innerHTML = `
                    <tr>
                        <td colspan="5" style="text-align: center; padding: var(--spacing-xl); color: var(--error);">
                            Fehler beim Laden der Abwesenheiten
                        </td>
                    </tr>
                `;
            }
        }
    }
    
    /**
     * Display user's own absences
     */
    function displayMyAbsences(absences) {
        const tbody = document.getElementById('my-absences-tbody');
        if (!tbody) return;
        
        if (absences.length === 0) {
            tbody.innerHTML = `
                <tr>
                    <td colspan="5" style="text-align: center; padding: var(--spacing-xl); color: var(--text-secondary);">
                        Keine Abwesenheiten geplant
                    </td>
                </tr>
            `;
            return;
        }
        
        tbody.innerHTML = absences.map(absence => {
            const timeRange = formatTimeRange(absence.start_time, absence.end_time);
            return `
                <tr>
                    <td>${formatDate(absence.start_date)}</td>
                    <td>${formatDate(absence.end_date)}</td>
                    <td>${timeRange}</td>
                    <td style="max-width: 300px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;" title="${escapeHtml(absence.reason)}">
                        ${escapeHtml(absence.reason)}
                    </td>
                    <td>
                        <button class="btn btn-sm" onclick="AbsencesManager.deleteAbsence(${absence.id}, false)" style="background: var(--error); padding: 0.25rem 0.5rem;">
                            <i data-lucide="trash-2" style="width: 16px; height: 16px;"></i>
                            <span>Löschen</span>
                        </button>
                    </td>
                </tr>
            `;
        }).join('');
        
        // Reinitialize Lucide icons
        if (window.lucide) {
            window.lucide.createIcons();
        }
    }
    
    /**
     * Load all absences (admin view)
     */
    async function loadAllAbsences() {
        try {
            const response = await fetch('/api/absences', {
                credentials: 'same-origin'
            });
            
            const data = await response.json();
            
            if (data.success && data.absences) {
                displayAllAbsences(data.absences);
            } else {
                throw new Error('Failed to load all absences');
            }
        } catch (error) {
            console.error('Error loading all absences:', error);
            const tbody = document.getElementById('all-absences-tbody');
            if (tbody) {
                tbody.innerHTML = `
                    <tr>
                        <td colspan="6" style="text-align: center; padding: var(--spacing-xl); color: var(--error);">
                            Fehler beim Laden der Abwesenheiten
                        </td>
                    </tr>
                `;
            }
        }
    }
    
    /**
     * Display all absences (admin view)
     */
    function displayAllAbsences(absences) {
        const tbody = document.getElementById('all-absences-tbody');
        if (!tbody) return;
        
        if (absences.length === 0) {
            tbody.innerHTML = `
                <tr>
                    <td colspan="6" style="text-align: center; padding: var(--spacing-xl); color: var(--text-secondary);">
                        Keine Abwesenheiten vorhanden
                    </td>
                </tr>
            `;
            return;
        }
        
        const canManage = typeof Permissions !== 'undefined' && 
                          Permissions.hasAnyPermission(['manage_absences', 'admin_all', '*']);
        
        tbody.innerHTML = absences.map(absence => {
            const displayName = absence.display_name || absence.username;
            const timeRange = formatTimeRange(absence.start_time, absence.end_time);
            const deleteButton = canManage ? `
                <button class="btn btn-sm" onclick="AbsencesManager.deleteAbsence(${absence.id}, true)" style="background: var(--error); padding: 0.25rem 0.5rem;">
                    <i data-lucide="trash-2" style="width: 16px; height: 16px;"></i>
                    <span>Löschen</span>
                </button>
            ` : '-';
            
            return `
                <tr>
                    <td><strong>${escapeHtml(displayName)}</strong></td>
                    <td>${formatDate(absence.start_date)}</td>
                    <td>${formatDate(absence.end_date)}</td>
                    <td>${timeRange}</td>
                    <td style="max-width: 300px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;" title="${escapeHtml(absence.reason)}">
                        ${escapeHtml(absence.reason)}
                    </td>
                    <td>${deleteButton}</td>
                </tr>
            `;
        }).join('');
        
        // Reinitialize Lucide icons
        if (window.lucide) {
            window.lucide.createIcons();
        }
    }
    
    /**
     * Delete absence
     */
    async function deleteAbsence(absenceId, isAdmin) {
        deleteCallback = async function() {
            try {
                const endpoint = isAdmin ? `/api/absences/${absenceId}/admin` : `/api/absences/${absenceId}`;
                
                const response = await fetch(endpoint, {
                    method: 'DELETE',
                    headers: {
                        'CSRF-Token': csrfToken
                    },
                    credentials: 'same-origin'
                });
                
                const data = await response.json();
                
                if (data.success) {
                    showToast(data.message || 'Abwesenheit erfolgreich gelöscht', 'success');
                    
                    // Reload absences
                    await loadMyAbsences();
                    if (typeof Permissions !== 'undefined' && 
                        Permissions.hasAnyPermission(['view_absences', 'manage_absences', 'admin_all', '*'])) {
                        await loadAllAbsences();
                    }
                    
                    closeModal('delete-modal');
                } else {
                    showToast(data.error || 'Fehler beim Löschen der Abwesenheit', 'error');
                }
            } catch (error) {
                console.error('Error:', error);
                showToast('Netzwerkfehler beim Löschen der Abwesenheit', 'error');
            }
        };
        
        // Show confirmation modal
        const modal = document.getElementById('delete-modal');
        const message = document.getElementById('delete-modal-message');
        
        if (message) {
            message.textContent = 'Möchten Sie diese Abwesenheit wirklich löschen?';
        }
        
        if (modal) {
            modal.classList.add('active');
        }
    }
    
    /**
     * Setup delete confirmation modal
     */
    function setupDeleteModal() {
        // Close modal buttons
        const modal = document.getElementById('delete-modal');
        if (!modal) return;
        
        const closeButtons = modal.querySelectorAll('[data-modal="delete-modal"]');
        closeButtons.forEach(btn => {
            btn.addEventListener('click', function() {
                closeModal('delete-modal');
            });
        });
        
        // Confirm delete button
        const confirmBtn = document.getElementById('delete-confirm-btn');
        if (confirmBtn) {
            confirmBtn.addEventListener('click', async function() {
                if (deleteCallback) {
                    await deleteCallback();
                }
            });
        }
        
        // Close on backdrop click
        const backdrop = modal.querySelector('.modal-backdrop');
        if (backdrop) {
            backdrop.addEventListener('click', function() {
                closeModal('delete-modal');
            });
        }
    }
    
    /**
     * Close modal
     */
    function closeModal(modalId) {
        const modal = document.getElementById(modalId);
        if (modal) {
            modal.classList.remove('active');
        }
        deleteCallback = null;
    }
    
    /**
     * Format date
     */
    function formatDate(dateString) {
        if (!dateString) return '-';
        const date = new Date(dateString);
        return date.toLocaleDateString('de-DE', {
            day: '2-digit',
            month: '2-digit',
            year: 'numeric'
        });
    }
    
    /**
     * Format time range
     */
    function formatTimeRange(startTime, endTime) {
        if (!startTime && !endTime) {
            return 'Ganztägig';
        }
        
        const start = startTime ? startTime.substring(0, 5) : '-';
        const end = endTime ? endTime.substring(0, 5) : '-';
        
        if (start !== '-' && end !== '-') {
            return `${start} - ${end}`;
        } else if (start !== '-') {
            return `ab ${start}`;
        } else if (end !== '-') {
            return `bis ${end}`;
        }
        
        return '-';
    }
    
    /**
     * Escape HTML
     */
    function escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }
    
    /**
     * Show toast notification
     */
    function showToast(message, type = 'info') {
        const toast = document.getElementById('toast');
        if (!toast) return;
        
        toast.textContent = message;
        toast.className = `toast toast-${type} show`;
        
        setTimeout(() => {
            toast.classList.remove('show');
        }, 4000);
    }
    
    /**
     * Set button loading state
     */
    function setButtonLoading(button, loading) {
        if (!button) return;
        
        if (loading) {
            button.disabled = true;
            button.classList.add('loading');
        } else {
            button.disabled = false;
            button.classList.remove('loading');
        }
    }
    
    // Return public API
    return {
        init: init,
        deleteAbsence: deleteAbsence
    };
})();

// Make AbsencesManager available globally
if (typeof window !== 'undefined') {
    window.AbsencesManager = AbsencesManager;
}
