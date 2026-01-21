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
        
        // Handle form submission
        loginForm.addEventListener('submit', handleLogin);
        
        /**
         * Loads reCAPTCHA configuration from server
         */
        async function loadRecaptchaConfig() {
            try {
                const response = await fetch('/api/recaptcha-config');
                recaptchaConfig = await response.json();

                if (recaptchaConfig.enabled && recaptchaConfig.siteKey) {
                    // Show reCAPTCHA container
                    const recaptchaContainer = document.getElementById('recaptcha-container');
                    if (recaptchaContainer) {
                        recaptchaContainer.style.display = 'block';
                        
                        // Load the reCAPTCHA widget with robust error handling
                        loadRecaptchaWidget(
                            recaptchaConfig.siteKey,
                            'recaptcha-container',
                            () => {
                                // Error callback
                                console.error('Failed to load reCAPTCHA widget');
                                showError('reCAPTCHA konnte nicht geladen werden. Bitte laden Sie die Seite neu.');
                            },
                            () => {
                                // Success callback
                                console.log('reCAPTCHA widget loaded successfully');
                            }
                        );
                    }
                }
            } catch (error) {
                console.warn('Failed to load reCAPTCHA config:', error);
            }
        }

        /**
         * Loads the reCAPTCHA widget with timeout and retry logic
         * @param {string} siteKey - reCAPTCHA site key
         * @param {string} elementId - ID of the container element
         * @param {Function} onError - Error callback
         * @param {Function} onSuccess - Success callback
         */
        function loadRecaptchaWidget(siteKey, elementId, onError, onSuccess) {
            // Check if grecaptcha is already available
            if (typeof grecaptcha !== 'undefined' && grecaptcha.render) {
                try {
                    const container = document.getElementById(elementId);
                    if (container) {
                        // Clear any existing content
                        const recaptchaDiv = container.querySelector('.g-recaptcha');
                        if (recaptchaDiv) {
                            recaptchaDiv.innerHTML = '';
                            grecaptcha.render(recaptchaDiv, {
                                'sitekey': siteKey
                            });
                        }
                    }
                    if (onSuccess) onSuccess();
                } catch (err) {
                    console.error('reCAPTCHA render error:', err);
                    if (onError) onError();
                }
                return;
            }
            
            // Wait for grecaptcha to load with timeout
            let attempts = 0;
            const maxAttempts = 50; // 5 seconds max (50 * 100ms)
            const checkRecaptcha = setInterval(() => {
                attempts++;
                if (typeof grecaptcha !== 'undefined' && grecaptcha.render) {
                    clearInterval(checkRecaptcha);
                    try {
                        const container = document.getElementById(elementId);
                        if (container) {
                            // Clear any existing content
                            const recaptchaDiv = container.querySelector('.g-recaptcha');
                            if (recaptchaDiv) {
                                recaptchaDiv.innerHTML = '';
                                grecaptcha.render(recaptchaDiv, {
                                    'sitekey': siteKey
                                });
                            }
                        }
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
