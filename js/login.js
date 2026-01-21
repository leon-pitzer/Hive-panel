/**
 * Login.js - Login Logic with Server API
 * Handles the login form, validation, reCAPTCHA verification, and authentication
 */

(function() {
    'use strict';
    
    let recaptchaConfig = null;
    let csrfToken = null;

    // Wait for DOM to be ready
    document.addEventListener('DOMContentLoaded', async function() {
        // Check if already logged in
        const authStatus = await Auth.checkAuthStatus();
        if (authStatus.authenticated) {
            window.location.href = 'dashboard.html';
            return;
        }

        // Load reCAPTCHA config
        await loadRecaptchaConfig();

        // Get form elements
        const loginForm = document.getElementById('login-form');
        const usernameInput = document.getElementById('username');
        const passwordInput = document.getElementById('password');
        const loginButton = document.getElementById('login-button');
        const errorMessage = document.getElementById('error-message');
        const infoMessage = document.getElementById('info-message');
        
        // Get card elements
        const loginCard = document.getElementById('login-card');
        const registerCard = document.getElementById('register-card');
        const registerToggle = document.getElementById('register-toggle');
        const loginToggle = document.getElementById('login-toggle');
        
        // Get info popup elements
        const infoToggle = document.getElementById('info-toggle');
        const infoPopup = document.getElementById('info-popup');
        const infoClose = document.getElementById('info-close');
        
        // Handle form submission
        loginForm.addEventListener('submit', handleLogin);
        
        // Setup info popup toggle
        if (infoToggle && infoPopup && infoClose) {
            infoToggle.addEventListener('click', function() {
                infoPopup.classList.remove('hidden');
            });
            
            infoClose.addEventListener('click', function() {
                infoPopup.classList.add('hidden');
            });
            
            // Close popup when clicking outside
            infoPopup.addEventListener('click', function(e) {
                if (e.target === infoPopup) {
                    infoPopup.classList.add('hidden');
                }
            });
        }
        
        // Setup login/register toggle
        if (registerToggle && loginCard && registerCard) {
            registerToggle.addEventListener('click', function(e) {
                e.preventDefault();
                switchToRegister();
            });
        }
        
        if (loginToggle && loginCard && registerCard) {
            loginToggle.addEventListener('click', function(e) {
                e.preventDefault();
                switchToLogin();
            });
        }
        
        /**
         * Switch to registration form
         */
        function switchToRegister() {
            loginCard.classList.add('slide-out-left');
            
            setTimeout(() => {
                loginCard.classList.add('hidden');
                loginCard.classList.remove('slide-out-left');
                
                registerCard.classList.remove('hidden');
                registerCard.classList.add('slide-in-right');
                
                setTimeout(() => {
                    registerCard.classList.remove('slide-in-right');
                }, 500);
            }, 500);
        }
        
        /**
         * Switch to login form
         */
        function switchToLogin() {
            registerCard.classList.add('slide-out-right');
            
            setTimeout(() => {
                registerCard.classList.add('hidden');
                registerCard.classList.remove('slide-out-right');
                
                loginCard.classList.remove('hidden');
                loginCard.classList.add('slide-in-left');
                
                setTimeout(() => {
                    loginCard.classList.remove('slide-in-left');
                }, 500);
            }, 500);
        }
        
        /**
         * Loads reCAPTCHA configuration from server
         */
        async function loadRecaptchaConfig() {
            try {
                // Try new endpoint first
                let response = await fetch('/api/recaptcha/config');
                
                // Fallback to old endpoint for backward compatibility
                if (!response.ok && response.status === 404) {
                    response = await fetch('/api/recaptcha-config');
                }
                
                if (!response.ok) {
                    throw new Error(`HTTP error! status: ${response.status}`);
                }
                recaptchaConfig = await response.json();
                
                // Validate site key format
                const isValidSiteKey = recaptchaConfig.siteKey && 
                                      recaptchaConfig.siteKey.length > 20 && 
                                      !recaptchaConfig.siteKey.includes('your-recaptcha');

                if (recaptchaConfig.enabled && isValidSiteKey) {
                    document.getElementById('recaptcha-container').style.display = 'block';
                    
                    loadRecaptchaWidget(
                        recaptchaConfig.siteKey, 
                        'recaptcha-element', 
                        function() { showRecaptchaError(); },
                        function() { console.log('reCAPTCHA widget loaded successfully'); }
                    );
                }
            } catch (error) {
                console.error('Failed to load reCAPTCHA config:', error);
            }
        }
        
        /**
         * Show reCAPTCHA error message
         */
        function showRecaptchaError() {
            showError('reCAPTCHA konnte nicht geladen werden. Bitte laden Sie die Seite neu.');
        }

        /**
         * Helper function to load reCAPTCHA with timeout
         * @param {string} siteKey - reCAPTCHA site key
         * @param {string} elementId - ID of the element to render into
         * @param {Function} onError - Error callback
         * @param {Function} onSuccess - Success callback
         */
        function loadRecaptchaWidget(siteKey, elementId, onError, onSuccess) {
            if (typeof grecaptcha !== 'undefined' && grecaptcha.render) {
                try {
                    grecaptcha.render(elementId, { 'sitekey': siteKey });
                    if (onSuccess) onSuccess();
                } catch (err) {
                    console.error('reCAPTCHA render error:', err);
                    if (onError) onError();
                }
                return;
            }
            
            // Wait for grecaptcha to load with timeout
            let attempts = 0;
            const maxAttempts = 50; // 5 seconds max
            const checkRecaptcha = setInterval(() => {
                attempts++;
                if (typeof grecaptcha !== 'undefined' && grecaptcha.render) {
                    clearInterval(checkRecaptcha);
                    try {
                        grecaptcha.render(elementId, { 'sitekey': siteKey });
                        if (onSuccess) onSuccess();
                    } catch (err) {
                        console.error('reCAPTCHA render error:', err);
                        if (onError) onError();
                    }
                } else if (attempts >= maxAttempts) {
                    clearInterval(checkRecaptcha);
                    console.error('reCAPTCHA script failed to load within timeout');
                    if (onError) onError();
                }
            }, 100);
        }

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
            
            // Get reCAPTCHA token if enabled
            let recaptchaToken = null;
            if (recaptchaConfig && recaptchaConfig.enabled) {
                if (typeof grecaptcha !== 'undefined' && grecaptcha.getResponse) {
                    try {
                        recaptchaToken = grecaptcha.getResponse();
                        if (!recaptchaToken) {
                            showError('Bitte bestätigen Sie, dass Sie kein Roboter sind.');
                            return;
                        }
                    } catch (e) {
                        console.warn('reCAPTCHA error:', e);
                    }
                }
            }
            
            // Show loading state
            setLoading(true);
            
            try {
                // Send login request to server
                const response = await fetch('/api/auth/login', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({
                        username,
                        password,
                        recaptchaToken
                    })
                });

                const data = await response.json();

                if (response.ok && data.success) {
                    // Successful login
                    showInfo('Login erfolgreich! Weiterleitung zum Dashboard...');
                    
                    setTimeout(() => {
                        window.location.href = 'dashboard.html';
                    }, 1000);
                } else {
                    // Failed login
                    setLoading(false);
                    
                    // Reset reCAPTCHA if available
                    if (recaptchaConfig && recaptchaConfig.enabled && typeof grecaptcha !== 'undefined' && grecaptcha.reset) {
                        try {
                            grecaptcha.reset();
                        } catch (e) {
                            console.warn('Could not reset reCAPTCHA:', e);
                        }
                    }
                    
                    showError(data.error || 'Anmeldung fehlgeschlagen. Bitte versuchen Sie es erneut.');
                }
            } catch (error) {
                setLoading(false);
                console.error('Login error:', error);
                showError('Ein Fehler ist aufgetreten. Bitte versuchen Sie es später erneut.');
                
                // Reset reCAPTCHA if available
                if (recaptchaConfig && recaptchaConfig.enabled && typeof grecaptcha !== 'undefined' && grecaptcha.reset) {
                    try {
                        grecaptcha.reset();
                    } catch (e) {
                        console.warn('Could not reset reCAPTCHA:', e);
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
         * Auto-focus username field
         */
        if (usernameInput) {
            usernameInput.focus();
        }
    });
})();
