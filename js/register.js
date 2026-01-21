/**
 * Register.js - Registration Logic
 * Handles the registration form, validation, and submission
 */

(function() {
    'use strict';
    
    // Wait for DOM to be ready
    document.addEventListener('DOMContentLoaded', async function() {
        // Check if already logged in
        const authStatus = await Auth.checkAuthStatus();
        if (authStatus.authenticated) {
            window.location.href = 'dashboard.html';
            return;
        }

        // Get form elements
        const registerForm = document.getElementById('register-form');
        const usernameInput = document.getElementById('register-username');
        const emailInput = document.getElementById('register-email');
        const passwordInput = document.getElementById('register-password');
        const confirmPasswordInput = document.getElementById('register-confirm-password');
        const registerButton = document.getElementById('register-button');
        const errorMessage = document.getElementById('register-error-message');
        const infoMessage = document.getElementById('register-info-message');
        const passwordStrengthDiv = document.getElementById('password-strength');
        
        // Handle password strength validation
        passwordInput.addEventListener('input', function() {
            const strength = checkPasswordStrength(this.value);
            updatePasswordStrength(strength);
        });
        
        // Handle form submission
        registerForm.addEventListener('submit', handleRegister);
        
        /**
         * Checks password strength
         * @param {string} password - Password to check
         * @returns {object} Strength information
         */
        function checkPasswordStrength(password) {
            let strength = 0;
            let feedback = [];
            
            if (password.length >= 8) strength++;
            if (password.length >= 12) strength++;
            if (/[a-z]/.test(password)) strength++;
            if (/[A-Z]/.test(password)) strength++;
            if (/[0-9]/.test(password)) strength++;
            if (/[^a-zA-Z0-9]/.test(password)) strength++;
            
            if (password.length < 8) {
                feedback.push('Mindestens 8 Zeichen');
            }
            if (!/[a-z]/.test(password)) {
                feedback.push('Kleinbuchstaben');
            }
            if (!/[A-Z]/.test(password)) {
                feedback.push('Großbuchstaben');
            }
            if (!/[0-9]/.test(password)) {
                feedback.push('Zahlen');
            }
            if (!/[^a-zA-Z0-9]/.test(password)) {
                feedback.push('Sonderzeichen');
            }
            
            let level = 'weak';
            if (strength >= 5) level = 'strong';
            else if (strength >= 3) level = 'medium';
            
            return { level, feedback };
        }
        
        /**
         * Updates password strength indicator
         * @param {object} strength - Strength information
         */
        function updatePasswordStrength(strength) {
            if (!passwordStrengthDiv) return;
            
            passwordStrengthDiv.classList.remove('hidden', 'weak', 'medium', 'strong');
            
            if (passwordInput.value.length === 0) {
                passwordStrengthDiv.classList.add('hidden');
                return;
            }
            
            passwordStrengthDiv.classList.add(strength.level);
            
            if (strength.level === 'weak') {
                passwordStrengthDiv.innerHTML = '<span class="strength-label">⚠️ Schwach</span> - Benötigt: ' + strength.feedback.join(', ');
            } else if (strength.level === 'medium') {
                passwordStrengthDiv.innerHTML = '<span class="strength-label">⚡ Mittel</span> - Empfohlen: ' + strength.feedback.join(', ');
            } else {
                passwordStrengthDiv.innerHTML = '<span class="strength-label">✓ Stark</span> - Gutes Passwort!';
            }
        }
        
        /**
         * Handles the registration form submission
         * @param {Event} event - Form submit event
         */
        async function handleRegister(event) {
            event.preventDefault();
            
            // Clear previous messages
            hideMessage(errorMessage);
            hideMessage(infoMessage);
            
            const username = usernameInput.value.trim();
            const email = emailInput.value.trim();
            const password = passwordInput.value;
            const confirmPassword = confirmPasswordInput.value;
            
            // Basic validation
            if (!username || !email || !password || !confirmPassword) {
                showError('Bitte füllen Sie alle Felder aus.');
                return;
            }
            
            // Username validation
            if (username.length < 3 || username.length > 30) {
                showError('Benutzername muss zwischen 3 und 30 Zeichen lang sein.');
                return;
            }
            
            if (!/^[a-zA-Z0-9_-]+$/.test(username)) {
                showError('Benutzername darf nur Buchstaben, Zahlen, _ und - enthalten.');
                return;
            }
            
            // Email validation
            if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
                showError('Bitte geben Sie eine gültige E-Mail-Adresse ein.');
                return;
            }
            
            // Password validation
            if (password.length < 8) {
                showError('Passwort muss mindestens 8 Zeichen lang sein.');
                return;
            }
            
            const strength = checkPasswordStrength(password);
            if (strength.level === 'weak') {
                showError('Passwort ist zu schwach. Bitte wählen Sie ein stärkeres Passwort.');
                return;
            }
            
            // Password confirmation
            if (password !== confirmPassword) {
                showError('Passwörter stimmen nicht überein.');
                return;
            }
            
            // Show loading state
            setLoading(true);
            
            try {
                // Send registration request to server
                const response = await fetch('/api/auth/register', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({
                        username,
                        email,
                        password,
                        confirmPassword
                    })
                });

                const data = await response.json();

                if (response.ok && data.success) {
                    // Successful registration
                    showInfo('Registrierungsanfrage erfolgreich eingereicht. Sie erhalten eine Benachrichtigung, sobald Ihr Account genehmigt wurde.');
                    
                    // Clear form
                    registerForm.reset();
                    passwordStrengthDiv.classList.add('hidden');
                    
                    // Switch back to login after delay
                    setTimeout(() => {
                        const loginToggle = document.getElementById('login-toggle');
                        if (loginToggle) {
                            loginToggle.click();
                        }
                    }, 3000);
                } else {
                    // Failed registration
                    setLoading(false);
                    
                    // Handle rate limiting
                    if (response.status === 429) {
                        showError('Zu viele Anfragen. Bitte versuchen Sie es später erneut.');
                    } else {
                        showError(data.error || 'Registrierung fehlgeschlagen. Bitte versuchen Sie es erneut.');
                    }
                }
            } catch (error) {
                setLoading(false);
                console.error('Registration error:', error);
                showError('Ein Fehler ist aufgetreten. Bitte versuchen Sie es später erneut.');
            }
        }
        
        /**
         * Shows an error message
         * @param {string} message - Error message to display
         */
        function showError(message) {
            errorMessage.textContent = message;
            errorMessage.classList.remove('hidden');
            errorMessage.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
        
        /**
         * Shows an info message
         * @param {string} message - Info message to display
         */
        function showInfo(message) {
            infoMessage.textContent = message;
            infoMessage.classList.remove('hidden');
            infoMessage.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
        
        /**
         * Hides a message element
         * @param {HTMLElement} element - Message element to hide
         */
        function hideMessage(element) {
            if (element) {
                element.classList.add('hidden');
            }
        }
        
        /**
         * Sets the loading state of the form
         * @param {boolean} loading - Whether the form is loading
         */
        function setLoading(loading) {
            const buttonText = registerButton.querySelector('.button-text');
            const spinner = registerButton.querySelector('.spinner');
            
            if (loading) {
                registerButton.disabled = true;
                buttonText.classList.add('hidden');
                spinner.classList.remove('hidden');
                usernameInput.disabled = true;
                emailInput.disabled = true;
                passwordInput.disabled = true;
                confirmPasswordInput.disabled = true;
            } else {
                registerButton.disabled = false;
                buttonText.classList.remove('hidden');
                spinner.classList.add('hidden');
                usernameInput.disabled = false;
                emailInput.disabled = false;
                passwordInput.disabled = false;
                confirmPasswordInput.disabled = false;
            }
        }
        
        /**
         * Auto-focus username field
         */
        if (usernameInput) {
            usernameInput.focus();
        }
    });
})();
