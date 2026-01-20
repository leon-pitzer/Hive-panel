/**
 * Admin Accounts Management Frontend
 * Handles account and role management
 */

(function() {
    'use strict';
    
    let csrfToken = null;
    let accounts = [];
    let roles = [];
    let currentEditAccount = null;
    let currentEditRole = null;
    let deleteCallback = null;
    
    // Available permissions (supporting both old and new naming conventions)
    const AVAILABLE_PERMISSIONS = [
        'manage_accounts',
        'view_accounts',
        'handle_requests',
        'manage_roles',
        'admin_all',
        'accounts.manage',      // New naming: equivalent to manage_accounts
        'accounts.view',        // New naming: equivalent to view_accounts
        'accounts.requests',    // New naming: equivalent to handle_requests
        'roles.manage'          // New naming: equivalent to manage_roles
    ];
    
    // Initialize on DOM load
    document.addEventListener('DOMContentLoaded', async function() {
        // Check permissions first
        if (!await checkPermissions()) {
            showToast('Keine Berechtigung für diese Seite', 'error');
            setTimeout(() => {
                window.location.href = '/dashboard.html';
            }, 2000);
            return;
        }
        
        // Get CSRF token
        csrfToken = await getCsrfToken();
        
        // Setup UI
        setupTabs();
        setupModals();
        setupForms();
        
        // Load data
        await loadAccounts();
        await loadRoles();
    });
    
    /**
     * Check if user has required permissions
     * NOTE: This is client-side validation only for UX.
     * All actual permission enforcement happens on the server.
     */
    async function checkPermissions() {
        if (typeof Permissions === 'undefined') {
            return false;
        }
        
        // Check for wildcard OR manage_accounts OR view_accounts (both old and new naming)
        return Permissions.hasAnyPermission([
            'manage_accounts', 'view_accounts', 'admin_all', '*',
            'accounts.manage', 'accounts.view'  // New permission naming
        ]);
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
     * Setup tab switching
     */
    function setupTabs() {
        const tabButtons = document.querySelectorAll('.tab-button');
        
        tabButtons.forEach(button => {
            button.addEventListener('click', function() {
                const targetTab = this.getAttribute('data-tab');
                
                // Update tab buttons
                tabButtons.forEach(btn => btn.classList.remove('active'));
                this.classList.add('active');
                
                // Update tab content
                document.querySelectorAll('.tab-content').forEach(content => {
                    content.classList.remove('active');
                });
                document.getElementById(`${targetTab}-tab`).classList.add('active');
            });
        });
    }
    
    /**
     * Setup modal handlers
     */
    function setupModals() {
        // Close modals on backdrop or X button click
        document.querySelectorAll('.modal-backdrop, .modal-close, [data-modal]').forEach(element => {
            element.addEventListener('click', function(e) {
                if (e.target === this) {
                    const modalId = this.getAttribute('data-modal') || this.closest('.modal').id;
                    if (modalId) {
                        closeModal(modalId);
                    }
                }
            });
        });
        
        // Create account button
        document.getElementById('create-account-btn').addEventListener('click', function() {
            openAccountModal();
        });
        
        // Create role button
        document.getElementById('create-role-btn').addEventListener('click', function() {
            openRoleModal();
        });
        
        // Delete confirm button
        document.getElementById('delete-confirm-btn').addEventListener('click', function() {
            if (deleteCallback) {
                deleteCallback();
                closeModal('delete-modal');
            }
        });
    }
    
    /**
     * Setup form handlers
     */
    function setupForms() {
        // Account form
        const accountForm = document.getElementById('account-form');
        accountForm.addEventListener('submit', async function(e) {
            e.preventDefault();
            await handleAccountSubmit();
        });
        
        // Role form
        const roleForm = document.getElementById('role-form');
        roleForm.addEventListener('submit', async function(e) {
            e.preventDefault();
            await handleRoleSubmit();
        });
        
        // Password generator
        document.getElementById('generate-password-account').addEventListener('click', function() {
            document.getElementById('account-password').value = generatePassword(16);
        });
    }
    
    /**
     * Load accounts from API
     */
    async function loadAccounts() {
        try {
            const response = await fetch('/api/admin/accounts', {
                credentials: 'same-origin'
            });
            
            if (!response.ok) {
                throw new Error('Failed to load accounts');
            }
            
            const data = await response.json();
            accounts = data.accounts || [];
            
            renderAccountsTable();
        } catch (error) {
            console.error('Error loading accounts:', error);
            showToast('Fehler beim Laden der Konten', 'error');
            
            const tbody = document.getElementById('accounts-tbody');
            tbody.innerHTML = `
                <tr>
                    <td colspan="5" class="empty-state">
                        <i data-lucide="alert-circle"></i>
                        <p>Fehler beim Laden der Konten</p>
                    </td>
                </tr>
            `;
            lucide.createIcons();
        }
    }
    
    /**
     * Load roles from API
     */
    async function loadRoles() {
        try {
            const response = await fetch('/api/admin/roles', {
                credentials: 'same-origin'
            });
            
            if (!response.ok) {
                throw new Error('Failed to load roles');
            }
            
            const data = await response.json();
            roles = data.roles || [];
            
            renderRolesTable();
            updateRoleSelects();
        } catch (error) {
            console.error('Error loading roles:', error);
            showToast('Fehler beim Laden der Rollen', 'error');
            
            const tbody = document.getElementById('roles-tbody');
            tbody.innerHTML = `
                <tr>
                    <td colspan="3" class="empty-state">
                        <i data-lucide="alert-circle"></i>
                        <p>Fehler beim Laden der Rollen</p>
                    </td>
                </tr>
            `;
            lucide.createIcons();
        }
    }
    
    /**
     * Render accounts table
     */
    function renderAccountsTable() {
        const tbody = document.getElementById('accounts-tbody');
        
        if (accounts.length === 0) {
            tbody.innerHTML = `
                <tr>
                    <td colspan="5" class="empty-state">
                        <i data-lucide="users"></i>
                        <p>Keine Konten vorhanden</p>
                    </td>
                </tr>
            `;
            lucide.createIcons();
            return;
        }
        
        tbody.innerHTML = accounts.map(account => {
            const censoredEmail = censorEmail(account.email);
            const permissionBadges = (account.permissions || []).map(perm => 
                `<span class="badge badge-primary">${escapeHtml(perm)}</span>`
            ).join(' ');
            
            return `
                <tr>
                    <td><strong>${escapeHtml(account.username)}</strong></td>
                    <td>
                        <span class="censored-text" data-email="${escapeHtml(account.email)}" data-censored="true">${censoredEmail}</span>
                        <button class="btn-reveal" data-action="toggle-email">
                            <i data-lucide="eye"></i>
                        </button>
                    </td>
                    <td>${account.role ? `<span class="badge badge-success">${escapeHtml(account.role)}</span>` : '<span class="badge">Keine</span>'}</td>
                    <td>${permissionBadges || '<span class="badge">Keine</span>'}</td>
                    <td>
                        <div class="table-actions">
                            <button class="btn-icon" data-action="edit-account" data-username="${escapeHtml(account.username)}" title="Bearbeiten">
                                <i data-lucide="edit"></i>
                            </button>
                            <button class="btn-icon btn-danger" data-action="delete-account" data-username="${escapeHtml(account.username)}" title="Löschen">
                                <i data-lucide="trash-2"></i>
                            </button>
                        </div>
                    </td>
                </tr>
            `;
        }).join('');
        
        // Add event listeners
        tbody.querySelectorAll('[data-action="toggle-email"]').forEach(btn => {
            btn.addEventListener('click', function() {
                toggleEmail(this);
            });
        });
        
        tbody.querySelectorAll('[data-action="edit-account"]').forEach(btn => {
            btn.addEventListener('click', function() {
                editAccount(this.getAttribute('data-username'));
            });
        });
        
        tbody.querySelectorAll('[data-action="delete-account"]').forEach(btn => {
            btn.addEventListener('click', function() {
                deleteAccount(this.getAttribute('data-username'));
            });
        });
        
        lucide.createIcons();
    }
    
    /**
     * Render roles table
     */
    function renderRolesTable() {
        const tbody = document.getElementById('roles-tbody');
        
        if (roles.length === 0) {
            tbody.innerHTML = `
                <tr>
                    <td colspan="3" class="empty-state">
                        <i data-lucide="shield"></i>
                        <p>Keine Rollen vorhanden</p>
                    </td>
                </tr>
            `;
            lucide.createIcons();
            return;
        }
        
        tbody.innerHTML = roles.map(role => {
            const permissionBadges = (role.permissions || []).map(perm => 
                `<span class="badge badge-primary">${escapeHtml(perm)}</span>`
            ).join(' ');
            
            return `
                <tr>
                    <td><strong>${escapeHtml(role.name)}</strong></td>
                    <td>${permissionBadges || '<span class="badge">Keine</span>'}</td>
                    <td>
                        <div class="table-actions">
                            <button class="btn-icon" data-action="edit-role" data-role-id="${escapeHtml(role.id)}" title="Bearbeiten">
                                <i data-lucide="edit"></i>
                            </button>
                            <button class="btn-icon btn-danger" data-action="delete-role" data-role-id="${escapeHtml(role.id)}" title="Löschen">
                                <i data-lucide="trash-2"></i>
                            </button>
                        </div>
                    </td>
                </tr>
            `;
        }).join('');
        
        // Add event listeners
        tbody.querySelectorAll('[data-action="edit-role"]').forEach(btn => {
            btn.addEventListener('click', function() {
                editRole(this.getAttribute('data-role-id'));
            });
        });
        
        tbody.querySelectorAll('[data-action="delete-role"]').forEach(btn => {
            btn.addEventListener('click', function() {
                deleteRole(this.getAttribute('data-role-id'));
            });
        });
        
        lucide.createIcons();
    }
    
    /**
     * Update role select dropdowns
     */
    function updateRoleSelects() {
        const roleSelect = document.getElementById('account-role');
        
        roleSelect.innerHTML = '<option value="">Keine Rolle</option>' + 
            roles.map(role => `<option value="${escapeHtml(role.name)}">${escapeHtml(role.name)}</option>`).join('');
    }
    
    /**
     * Open account modal (create or edit)
     */
    function openAccountModal(account = null) {
        currentEditAccount = account;
        
        const modal = document.getElementById('account-modal');
        const title = document.getElementById('account-modal-title');
        const submitBtn = document.getElementById('account-submit-btn');
        const form = document.getElementById('account-form');
        
        form.reset();
        
        if (account) {
            title.textContent = 'Konto bearbeiten';
            submitBtn.textContent = 'Speichern';
            
            document.getElementById('account-username').value = account.username;
            document.getElementById('account-username').disabled = true;
            document.getElementById('account-email').value = account.email;
            document.getElementById('account-displayname').value = account.displayName || '';
            document.getElementById('account-role').value = account.role || '';
            document.getElementById('account-password').required = false;
            
            // Set permissions
            document.querySelectorAll('#account-permissions input[type="checkbox"]').forEach(checkbox => {
                checkbox.checked = (account.permissions || []).includes(checkbox.value);
            });
        } else {
            title.textContent = 'Konto erstellen';
            submitBtn.textContent = 'Erstellen';
            document.getElementById('account-username').disabled = false;
            document.getElementById('account-password').required = true;
            
            // Clear permissions
            document.querySelectorAll('#account-permissions input[type="checkbox"]').forEach(checkbox => {
                checkbox.checked = false;
            });
        }
        
        openModal('account-modal');
    }
    
    /**
     * Open role modal (create or edit)
     */
    function openRoleModal(role = null) {
        currentEditRole = role;
        
        const modal = document.getElementById('role-modal');
        const title = document.getElementById('role-modal-title');
        const submitBtn = document.getElementById('role-submit-btn');
        const form = document.getElementById('role-form');
        
        form.reset();
        
        if (role) {
            title.textContent = 'Rolle bearbeiten';
            submitBtn.textContent = 'Speichern';
            
            document.getElementById('role-name').value = role.name;
            
            // Set permissions
            document.querySelectorAll('#role-permissions input[type="checkbox"]').forEach(checkbox => {
                checkbox.checked = (role.permissions || []).includes(checkbox.value);
            });
        } else {
            title.textContent = 'Rolle erstellen';
            submitBtn.textContent = 'Erstellen';
            
            // Clear permissions
            document.querySelectorAll('#role-permissions input[type="checkbox"]').forEach(checkbox => {
                checkbox.checked = false;
            });
        }
        
        openModal('role-modal');
    }
    
    /**
     * Handle account form submit
     */
    async function handleAccountSubmit() {
        const submitBtn = document.getElementById('account-submit-btn');
        setButtonLoading(submitBtn, true);
        
        const username = document.getElementById('account-username').value.trim();
        const email = document.getElementById('account-email').value.trim();
        const password = document.getElementById('account-password').value;
        const displayName = document.getElementById('account-displayname').value.trim();
        const role = document.getElementById('account-role').value;
        
        const permissions = Array.from(document.querySelectorAll('#account-permissions input[type="checkbox"]:checked'))
            .map(cb => cb.value);
        
        const accountData = {
            username,
            email,
            displayName,
            role: role || null,
            permissions
        };
        
        // Use different field name for password based on operation type
        if (password) {
            const passwordField = currentEditAccount ? 'newPassword' : 'password';
            accountData[passwordField] = password;
        }
        
        try {
            let response;
            
            if (currentEditAccount) {
                // Update existing account
                response = await fetch(`/api/admin/accounts/${currentEditAccount.username}`, {
                    method: 'PUT',
                    headers: {
                        'Content-Type': 'application/json',
                        'CSRF-Token': csrfToken
                    },
                    credentials: 'same-origin',
                    body: JSON.stringify(accountData)
                });
            } else {
                // Create new account
                response = await fetch('/api/admin/accounts', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'CSRF-Token': csrfToken
                    },
                    credentials: 'same-origin',
                    body: JSON.stringify(accountData)
                });
            }
            
            const data = await response.json();
            
            if (response.ok && data.success) {
                showToast(data.message || 'Konto erfolgreich gespeichert', 'success');
                closeModal('account-modal');
                await loadAccounts();
            } else {
                showToast(data.error || 'Fehler beim Speichern des Kontos', 'error');
            }
        } catch (error) {
            console.error('Error:', error);
            showToast('Netzwerkfehler beim Speichern des Kontos', 'error');
        } finally {
            setButtonLoading(submitBtn, false);
        }
    }
    
    /**
     * Handle role form submit
     */
    async function handleRoleSubmit() {
        const submitBtn = document.getElementById('role-submit-btn');
        setButtonLoading(submitBtn, true);
        
        const name = document.getElementById('role-name').value.trim();
        const permissions = Array.from(document.querySelectorAll('#role-permissions input[type="checkbox"]:checked'))
            .map(cb => cb.value);
        
        const roleData = {
            name,
            permissions
        };
        
        try {
            let response;
            
            if (currentEditRole) {
                // Update existing role
                response = await fetch(`/api/admin/roles/${currentEditRole.id}`, {
                    method: 'PUT',
                    headers: {
                        'Content-Type': 'application/json',
                        'CSRF-Token': csrfToken
                    },
                    credentials: 'same-origin',
                    body: JSON.stringify(roleData)
                });
            } else {
                // Create new role
                response = await fetch('/api/admin/roles', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'CSRF-Token': csrfToken
                    },
                    credentials: 'same-origin',
                    body: JSON.stringify(roleData)
                });
            }
            
            const data = await response.json();
            
            if (response.ok && data.success) {
                showToast(data.message || 'Rolle erfolgreich gespeichert', 'success');
                closeModal('role-modal');
                await loadRoles();
            } else {
                showToast(data.error || 'Fehler beim Speichern der Rolle', 'error');
            }
        } catch (error) {
            console.error('Error:', error);
            showToast('Netzwerkfehler beim Speichern der Rolle', 'error');
        } finally {
            setButtonLoading(submitBtn, false);
        }
    }
    
    /**
     * Edit account
     */
    function editAccount(username) {
        const account = accounts.find(acc => acc.username === username);
        if (account) {
            openAccountModal(account);
        }
    }
    
    /**
     * Edit role
     */
    function editRole(roleId) {
        const role = roles.find(r => r.id === roleId);
        if (role) {
            openRoleModal(role);
        }
    }
    
    /**
     * Delete account
     */
    function deleteAccount(username) {
        const account = accounts.find(acc => acc.username === username);
        if (!account) return;
        
        document.getElementById('delete-modal-title').textContent = 'Konto löschen';
        document.getElementById('delete-modal-message').textContent = 
            `Möchten Sie das Konto "${username}" wirklich löschen? Diese Aktion kann nicht rückgängig gemacht werden.`;
        
        deleteCallback = async () => {
            try {
                const response = await fetch(`/api/admin/accounts/${username}`, {
                    method: 'DELETE',
                    headers: {
                        'CSRF-Token': csrfToken
                    },
                    credentials: 'same-origin'
                });
                
                const data = await response.json();
                
                if (response.ok && data.success) {
                    showToast(data.message || 'Konto erfolgreich gelöscht', 'success');
                    await loadAccounts();
                } else {
                    showToast(data.error || 'Fehler beim Löschen des Kontos', 'error');
                }
            } catch (error) {
                console.error('Error:', error);
                showToast('Netzwerkfehler beim Löschen des Kontos', 'error');
            }
        };
        
        openModal('delete-modal');
    }
    
    /**
     * Delete role
     */
    function deleteRole(roleId) {
        const role = roles.find(r => r.id === roleId);
        if (!role) return;
        
        document.getElementById('delete-modal-title').textContent = 'Rolle löschen';
        document.getElementById('delete-modal-message').textContent = 
            `Möchten Sie die Rolle "${role.name}" wirklich löschen? Diese Aktion kann nicht rückgängig gemacht werden.`;
        
        deleteCallback = async () => {
            try {
                const response = await fetch(`/api/admin/roles/${roleId}`, {
                    method: 'DELETE',
                    headers: {
                        'CSRF-Token': csrfToken
                    },
                    credentials: 'same-origin'
                });
                
                const data = await response.json();
                
                if (response.ok && data.success) {
                    showToast(data.message || 'Rolle erfolgreich gelöscht', 'success');
                    await loadRoles();
                } else {
                    showToast(data.error || 'Fehler beim Löschen der Rolle', 'error');
                }
            } catch (error) {
                console.error('Error:', error);
                showToast('Netzwerkfehler beim Löschen der Rolle', 'error');
            }
        };
        
        openModal('delete-modal');
    }
    
    /**
     * Toggle email visibility
     */
    function toggleEmail(button) {
        const emailSpan = button.previousElementSibling;
        const isCensored = emailSpan.getAttribute('data-censored') === 'true';
        const realEmail = emailSpan.getAttribute('data-email');
        
        if (isCensored) {
            emailSpan.textContent = realEmail;
            emailSpan.classList.remove('censored-text');
            emailSpan.setAttribute('data-censored', 'false');
            button.querySelector('i').setAttribute('data-lucide', 'eye-off');
        } else {
            emailSpan.textContent = censorEmail(realEmail);
            emailSpan.classList.add('censored-text');
            emailSpan.setAttribute('data-censored', 'true');
            button.querySelector('i').setAttribute('data-lucide', 'eye');
        }
        
        lucide.createIcons();
    }
    
    /**
     * Open modal
     */
    function openModal(modalId) {
        const modal = document.getElementById(modalId);
        if (modal) {
            modal.classList.add('show');
            document.body.style.overflow = 'hidden';
            
            // Re-render icons
            setTimeout(() => {
                lucide.createIcons();
            }, 10);
        }
    }
    
    /**
     * Close modal
     */
    function closeModal(modalId) {
        const modal = document.getElementById(modalId);
        if (modal) {
            modal.classList.remove('show');
            document.body.style.overflow = '';
            
            // Reset forms if needed
            if (modalId === 'account-modal') {
                document.getElementById('account-form').reset();
                currentEditAccount = null;
            } else if (modalId === 'role-modal') {
                document.getElementById('role-form').reset();
                currentEditRole = null;
            } else if (modalId === 'delete-modal') {
                deleteCallback = null;
            }
        }
    }
    
    /**
     * Censor email address
     */
    function censorEmail(email) {
        if (!email) return '***';
        
        const parts = email.split('@');
        if (parts.length !== 2) return '***';
        
        const localPart = parts[0];
        const domain = parts[1];
        
        const visibleChars = Math.min(2, Math.floor(localPart.length / 3));
        const censoredLocal = localPart.substring(0, visibleChars) + '***';
        
        return `${censoredLocal}@${domain}`;
    }
    
    /**
     * Generate random password
     */
    function generatePassword(length = 16) {
        const charset = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*';
        let password = '';
        
        for (let i = 0; i < length; i++) {
            password += charset.charAt(Math.floor(Math.random() * charset.length));
        }
        
        return password;
    }
    
    /**
     * Escape HTML to prevent XSS
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
})();
