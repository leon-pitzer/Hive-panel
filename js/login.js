/**
 * Login.js - Login Logic with reCAPTCHA
 * Handles the login form, validation, reCAPTCHA verification, and authentication
 */

(function() {
    'use strict';
    
    // Wait for DOM to be ready
    document.addEventListener('DOMContentLoaded', function() {
        // Redirect if already logged in
        if (Auth.isAuthenticated()) {
            window.location.href = 'dashboard.html';
            return;
        }
        
        // Get form elements
        const loginForm = document.getElementById('login-form');
        const usernameInput = document.getElementById('username');
        const passwordInput = document.getElementById('password');
        const loginButton = document.getElementById('login-button');
        const errorMessage = document.getElementById('error-message');
        const infoMessage = document.getElementById('info-message');
        
        // Check if default admin was just created
        checkForNewAdmin();
        
        // Handle form submission
        loginForm.addEventListener('submit', handleLogin);
        
        /**
         * Handles the login form submission
         * @param {Event} event - Form submit event
         */
        async function handleLogin(event) {
            event.preventDefault();
            
            // Clear previous messages
            hideMessage(errorMessage);
            hideMessage(infoMessage);
            
            const username = usernameInput.value.trim();
            const password = passwordInput.value;
            
            // Basic validation
            if (!username || !password) {
                showError('Bitte füllen Sie alle Felder aus.');
                return;
            }
            
            // Check rate limiting BEFORE reCAPTCHA
            const lockout = RateLimit.checkLockout(username);
            if (lockout.isLocked) {
                const message = RateLimit.getLockoutMessage(username);
                showError(message);
                return;
            }
            
            // Verify reCAPTCHA
            const recaptchaResponse = grecaptcha.getResponse();
            if (!recaptchaResponse) {
                showError('Bitte bestätigen Sie, dass Sie kein Roboter sind.');
                return;
            }
            
            // Show loading state
            setLoading(true);
            
            // Simulate network delay for better UX
            await new Promise(resolve => setTimeout(resolve, 500));
            
            // Verify credentials
            const user = Users.verifyPassword(username, password);
            
            if (user) {
                // Successful login
                RateLimit.reset(username); // Reset failed attempts
                Auth.createSession(user.username, user.role);
                
                // Show success message briefly before redirect
                showInfo('Login erfolgreich! Weiterleitung zum Dashboard...');
                
                setTimeout(() => {
                    window.location.href = 'dashboard.html';
                }, 1000);
            } else {
                // Failed login
                const rateLimitStatus = RateLimit.recordFailedAttempt(username);
                
                setLoading(false);
                grecaptcha.reset(); // Reset reCAPTCHA
                
                if (rateLimitStatus.isLocked) {
                    const message = RateLimit.getLockoutMessage(username);
                    showError(message);
                } else {
                    const attemptsLeft = 5 - rateLimitStatus.attempts;
                    if (attemptsLeft > 0 && rateLimitStatus.attempts > 0) {
                        showError(`Ungültige Anmeldedaten. Noch ${attemptsLeft} Versuch${attemptsLeft !== 1 ? 'e' : ''} übrig.`);
                    } else {
                        showError('Ungültige Anmeldedaten. Bitte versuchen Sie es erneut.');
                    }
                }
            }
        }
        
        /**
         * Shows an error message
         * @param {string} message - Error message to display
         */
        function showError(message) {
            errorMessage.textContent = message;
            errorMessage.classList.remove('hidden');
        }
        
        /**
         * Shows an info message
         * @param {string} message - Info message to display
         */
        function showInfo(message) {
            infoMessage.textContent = message;
            infoMessage.classList.remove('hidden');
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
            const buttonText = loginButton.querySelector('.button-text');
            const spinner = loginButton.querySelector('.spinner');
            
            if (loading) {
                loginButton.disabled = true;
                buttonText.classList.add('hidden');
                spinner.classList.remove('hidden');
                usernameInput.disabled = true;
                passwordInput.disabled = true;
            } else {
                loginButton.disabled = false;
                buttonText.classList.remove('hidden');
                spinner.classList.add('hidden');
                usernameInput.disabled = false;
                passwordInput.disabled = false;
            }
        }
        
        /**
         * Checks if a new admin user was created and shows info
         */
        function checkForNewAdmin() {
            const users = Users.getAllUsers();
            if (users.length === 1 && users[0].username === 'admin') {
                showInfo('Standard-Admin erstellt. Benutzername: admin, Passwort: Admin123! - Bitte ändern Sie das Passwort nach der ersten Anmeldung!');
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
