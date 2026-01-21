/**
 * Account Management Frontend
 * Handles account settings forms and interactions
 */

(function() {
    'use strict';
    
    let csrfToken = null;
    
    // Initialize on DOM load
    document.addEventListener('DOMContentLoaded', async function() {
        // Get CSRF token
        csrfToken = await getCsrfToken();
        
        // Load current profile
        await loadProfile();
        
        // Setup form handlers
        setupUsernameForm();
        setupPasswordForm();
        setupEmailForm();
        setupDisplayNameForm();
        setupPasswordGenerator();
        setupPasswordStrength();
        setupEditButtons();
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
     * Load current profile data
     */
    async function loadProfile() {
        try {
            const response = await fetch('/api/account/profile', {
                credentials: 'same-origin'
            });
            
            if (!response.ok) {
                throw new Error('Failed to load profile');
            }
            
            const data = await response.json();
            
            if (data.success && data.profile) {
                const profile = data.profile;
                
                // Display current username
                const usernameDisplay = document.getElementById('current-username-display');
                if (usernameDisplay) {
                    if (profile.username) {
                        usernameDisplay.textContent = profile.username;
                    } else {
                        usernameDisplay.textContent = 'Kein Benutzername gefunden';
                    }
                }
                
                // Display current email
                const emailDisplay = document.getElementById('current-email-display');
                if (emailDisplay) {
                    if (profile.email) {
                        emailDisplay.textContent = profile.email;
                    } else {
                        emailDisplay.textContent = 'Keine E-Mail hinterlegt';
                    }
                }
                
                // Populate email field (hidden initially)
                const emailField = document.getElementById('email');
                if (emailField) {
                    if (profile.email) {
                        emailField.value = profile.email;
                        emailField.placeholder = 'E-Mail-Adresse eingeben';
                    } else {
                        emailField.value = '';
                        emailField.placeholder = 'Keine E-Mail hinterlegt';
                    }
                }
                
                // Populate display name field
                const displayNameField = document.getElementById('display-name');
                if (displayNameField) {
                    if (profile.displayName) {
                        displayNameField.value = profile.displayName;
                        displayNameField.placeholder = 'Anzeigename eingeben';
                    } else {
                        displayNameField.value = '';
                        displayNameField.placeholder = 'Kein Anzeigename hinterlegt';
                    }
                }
            }
        } catch (error) {
            console.error('Error loading profile:', error);
        }
    }
    
    /**
     * Setup username change form
     */
    function setupUsernameForm() {
        const form = document.getElementById('username-form');
        if (!form) return;
        
        form.addEventListener('submit', async function(e) {
            e.preventDefault();
            
            const newUsername = document.getElementById('new-username').value.trim();
            
            if (!newUsername) {
                showToast('Bitte geben Sie einen Benutzernamen ein', 'error');
                return;
            }
            
            if (!confirm('Möchten Sie Ihren Benutzernamen wirklich ändern?')) {
                return;
            }
            
            const submitBtn = form.querySelector('button[type="submit"]');
            setButtonLoading(submitBtn, true);
            
            try {
                const response = await fetch('/api/account/username', {
                    method: 'PUT',
                    headers: {
                        'Content-Type': 'application/json',
                        'CSRF-Token': csrfToken
                    },
                    credentials: 'same-origin',
                    body: JSON.stringify({ newUsername })
                });
                
                const data = await response.json();
                
                if (data.success) {
                    showToast(data.message || 'Benutzername erfolgreich geändert', 'success');
                    form.reset();
                    
                    // Update displayed username
                    const usernameDisplay = document.getElementById('current-username-display');
                    if (usernameDisplay) {
                        usernameDisplay.textContent = newUsername;
                    }
                    
                    // Hide form and show edit button
                    form.style.display = 'none';
                    const editBtn = document.getElementById('edit-username-btn');
                    if (editBtn) {
                        editBtn.style.display = 'block';
                    }
                } else {
                    showToast(data.error || 'Fehler beim Ändern des Benutzernamens', 'error');
                }
            } catch (error) {
                console.error('Error:', error);
                showToast('Netzwerkfehler beim Ändern des Benutzernamens', 'error');
            } finally {
                setButtonLoading(submitBtn, false);
            }
        });
    }
    
    /**
     * Setup password change form
     */
    function setupPasswordForm() {
        const form = document.getElementById('password-form');
        if (!form) return;
        
        form.addEventListener('submit', async function(e) {
            e.preventDefault();
            
            const currentPassword = document.getElementById('current-password').value;
            const newPassword = document.getElementById('new-password').value;
            const confirmPassword = document.getElementById('confirm-password').value;
            
            if (!currentPassword || !newPassword || !confirmPassword) {
                showToast('Bitte füllen Sie alle Felder aus', 'error');
                return;
            }
            
            if (newPassword !== confirmPassword) {
                showToast('Die Passwörter stimmen nicht überein', 'error');
                return;
            }
            
            if (newPassword.length < 8) {
                showToast('Das Passwort muss mindestens 8 Zeichen lang sein', 'error');
                return;
            }
            
            if (!confirm('Möchten Sie Ihr Passwort wirklich ändern?')) {
                return;
            }
            
            const submitBtn = form.querySelector('button[type="submit"]');
            setButtonLoading(submitBtn, true);
            
            try {
                const response = await fetch('/api/account/password', {
                    method: 'PUT',
                    headers: {
                        'Content-Type': 'application/json',
                        'CSRF-Token': csrfToken
                    },
                    credentials: 'same-origin',
                    body: JSON.stringify({ currentPassword, newPassword })
                });
                
                const data = await response.json();
                
                if (data.success) {
                    showToast(data.message || 'Passwort erfolgreich geändert', 'success');
                    form.reset();
                    updatePasswordStrength('');
                } else {
                    showToast(data.error || 'Fehler beim Ändern des Passworts', 'error');
                }
            } catch (error) {
                console.error('Error:', error);
                showToast('Netzwerkfehler beim Ändern des Passworts', 'error');
            } finally {
                setButtonLoading(submitBtn, false);
            }
        });
    }
    
    /**
     * Setup email form
     */
    function setupEmailForm() {
        const form = document.getElementById('email-form');
        if (!form) return;
        
        form.addEventListener('submit', async function(e) {
            e.preventDefault();
            
            const email = document.getElementById('email').value.trim();
            
            if (!email || !isValidEmail(email)) {
                showToast('Bitte geben Sie eine gültige E-Mail-Adresse ein', 'error');
                return;
            }
            
            const submitBtn = form.querySelector('button[type="submit"]');
            setButtonLoading(submitBtn, true);
            
            try {
                const response = await fetch('/api/account/email', {
                    method: 'PUT',
                    headers: {
                        'Content-Type': 'application/json',
                        'CSRF-Token': csrfToken
                    },
                    credentials: 'same-origin',
                    body: JSON.stringify({ email })
                });
                
                const data = await response.json();
                
                if (data.success) {
                    showToast(data.message || 'E-Mail erfolgreich gespeichert', 'success');
                    
                    // Update displayed email
                    const emailDisplay = document.getElementById('current-email-display');
                    if (emailDisplay) {
                        emailDisplay.textContent = email;
                    }
                    
                    // Hide form and show edit button
                    form.style.display = 'none';
                    const editBtn = document.getElementById('edit-email-btn');
                    if (editBtn) {
                        editBtn.style.display = 'block';
                    }
                } else {
                    showToast(data.error || 'Fehler beim Speichern der E-Mail', 'error');
                }
            } catch (error) {
                console.error('Error:', error);
                showToast('Netzwerkfehler beim Speichern der E-Mail', 'error');
            } finally {
                setButtonLoading(submitBtn, false);
            }
        });
    }
    
    /**
     * Setup display name form
     */
    function setupDisplayNameForm() {
        const form = document.getElementById('displayname-form');
        if (!form) return;
        
        form.addEventListener('submit', async function(e) {
            e.preventDefault();
            
            const displayName = document.getElementById('display-name').value.trim();
            
            if (!displayName) {
                showToast('Bitte geben Sie einen Anzeigenamen ein', 'error');
                return;
            }
            
            const submitBtn = form.querySelector('button[type="submit"]');
            setButtonLoading(submitBtn, true);
            
            try {
                const response = await fetch('/api/account/displayname', {
                    method: 'PUT',
                    headers: {
                        'Content-Type': 'application/json',
                        'CSRF-Token': csrfToken
                    },
                    credentials: 'same-origin',
                    body: JSON.stringify({ displayName })
                });
                
                const data = await response.json();
                
                if (data.success) {
                    showToast(data.message || 'Anzeigename erfolgreich gespeichert', 'success');
                } else {
                    showToast(data.error || 'Fehler beim Speichern des Anzeigenamens', 'error');
                }
            } catch (error) {
                console.error('Error:', error);
                showToast('Netzwerkfehler beim Speichern des Anzeigenamens', 'error');
            } finally {
                setButtonLoading(submitBtn, false);
            }
        });
    }
    
    /**
     * Setup password generator
     */
    function setupPasswordGenerator() {
        const btn = document.getElementById('generate-password-btn');
        if (!btn) return;
        
        btn.addEventListener('click', async function() {
            setButtonLoading(btn, true);
            
            try {
                const response = await fetch('/api/account/generate-password', {
                    method: 'POST',
                    credentials: 'same-origin'
                });
                
                const data = await response.json();
                
                if (data.success && data.password) {
                    const newPasswordField = document.getElementById('new-password');
                    const confirmPasswordField = document.getElementById('confirm-password');
                    
                    newPasswordField.value = data.password;
                    confirmPasswordField.value = data.password;
                    
                    updatePasswordStrength(data.password);
                    
                    showToast('Sicheres Passwort generiert. Bitte kopieren Sie es.', 'success');
                } else {
                    showToast('Fehler beim Generieren des Passworts', 'error');
                }
            } catch (error) {
                console.error('Error:', error);
                showToast('Netzwerkfehler beim Generieren des Passworts', 'error');
            } finally {
                setButtonLoading(btn, false);
            }
        });
    }
    
    /**
     * Setup password strength indicator
     */
    function setupPasswordStrength() {
        const passwordField = document.getElementById('new-password');
        if (!passwordField) return;
        
        passwordField.addEventListener('input', function() {
            updatePasswordStrength(this.value);
        });
    }
    
    /**
     * Update password strength indicator
     */
    function updatePasswordStrength(password) {
        const indicator = document.getElementById('password-strength');
        if (!indicator) return;
        
        if (!password) {
            indicator.innerHTML = '';
            indicator.className = 'password-strength';
            return;
        }
        
        let strength = 0;
        let label = '';
        let colorClass = '';
        
        // Length check
        if (password.length >= 8) strength++;
        if (password.length >= 12) strength++;
        
        // Character variety
        if (/[a-z]/.test(password)) strength++;
        if (/[A-Z]/.test(password)) strength++;
        if (/[0-9]/.test(password)) strength++;
        if (/[^a-zA-Z0-9]/.test(password)) strength++;
        
        // Determine label and color
        if (strength <= 2) {
            label = 'Schwach';
            colorClass = 'weak';
        } else if (strength <= 4) {
            label = 'Mittel';
            colorClass = 'medium';
        } else {
            label = 'Stark';
            colorClass = 'strong';
        }
        
        indicator.innerHTML = `<span class="strength-label ${colorClass}">Passwortstärke: ${label}</span>`;
        indicator.className = `password-strength ${colorClass}`;
    }
    
    /**
     * Validate email format
     */
    function isValidEmail(email) {
        const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        return re.test(email);
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
     * Setup edit buttons for username and email
     */
    function setupEditButtons() {
        // Username edit button
        const editUsernameBtn = document.getElementById('edit-username-btn');
        const usernameForm = document.getElementById('username-form');
        const cancelUsernameBtn = document.getElementById('cancel-username-btn');
        
        if (editUsernameBtn && usernameForm) {
            editUsernameBtn.addEventListener('click', function() {
                usernameForm.style.display = 'block';
                editUsernameBtn.style.display = 'none';
            });
        }
        
        if (cancelUsernameBtn && usernameForm) {
            cancelUsernameBtn.addEventListener('click', function() {
                usernameForm.style.display = 'none';
                editUsernameBtn.style.display = 'block';
                usernameForm.reset();
            });
        }
        
        // Email edit button
        const editEmailBtn = document.getElementById('edit-email-btn');
        const emailForm = document.getElementById('email-form');
        const cancelEmailBtn = document.getElementById('cancel-email-btn');
        
        if (editEmailBtn && emailForm) {
            editEmailBtn.addEventListener('click', function() {
                emailForm.style.display = 'block';
                editEmailBtn.style.display = 'none';
            });
        }
        
        if (cancelEmailBtn && emailForm) {
            cancelEmailBtn.addEventListener('click', function() {
                emailForm.style.display = 'none';
                editEmailBtn.style.display = 'block';
                emailForm.reset();
                // Reload the email value from display
                loadProfile();
            });
        }
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
