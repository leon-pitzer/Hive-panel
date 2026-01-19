/**
 * reCAPTCHA verification utility
 * Handles server-side reCAPTCHA verification
 */

const https = require('https');
const querystring = require('querystring');
const config = require('./config');
const { logger, securityLogger } = require('./logger');

/**
 * Verifies a reCAPTCHA response token
 * @param {string} token - reCAPTCHA response token from client
 * @param {string} remoteIP - Client IP address
 * @returns {Promise<Object>} Verification result { success: boolean, error?: string }
 */
async function verifyRecaptcha(token, remoteIP) {
    // If reCAPTCHA is disabled, always return success
    if (!config.recaptcha.enabled) {
        logger.debug('reCAPTCHA verification skipped (disabled)');
        return { success: true };
    }

    // Validate token
    if (!token || typeof token !== 'string') {
        securityLogger.warn('reCAPTCHA verification failed: missing token', { ip: remoteIP });
        return { success: false, error: 'reCAPTCHA token missing' };
    }

    try {
        const postData = querystring.stringify({
            secret: config.recaptcha.secretKey,
            response: token,
            remoteip: remoteIP
        });

        const result = await new Promise((resolve, reject) => {
            const req = https.request({
                hostname: 'www.google.com',
                path: '/recaptcha/api/siteverify',
                method: 'POST',
                headers: {
                    'Content-Type': 'application/x-www-form-urlencoded',
                    'Content-Length': Buffer.byteLength(postData)
                }
            }, (res) => {
                let data = '';

                res.on('data', (chunk) => {
                    data += chunk;
                });

                res.on('end', () => {
                    try {
                        const response = JSON.parse(data);
                        resolve(response);
                    } catch (error) {
                        reject(new Error('Invalid JSON response from reCAPTCHA'));
                    }
                });
            });

            req.on('error', (error) => {
                reject(error);
            });

            req.write(postData);
            req.end();
        });

        if (result.success) {
            logger.debug('reCAPTCHA verification successful', { ip: remoteIP });
            return { success: true };
        } else {
            securityLogger.warn('reCAPTCHA verification failed', {
                ip: remoteIP,
                errorCodes: result['error-codes']
            });
            return {
                success: false,
                error: 'reCAPTCHA verification failed',
                errorCodes: result['error-codes']
            };
        }
    } catch (error) {
        logger.error('reCAPTCHA verification error:', {
            error: error.message,
            ip: remoteIP
        });
        return {
            success: false,
            error: 'reCAPTCHA verification error'
        };
    }
}

/**
 * Gets reCAPTCHA configuration for client
 * @returns {Object} Client configuration
 */
function getRecaptchaConfig() {
    return {
        enabled: config.recaptcha.enabled,
        siteKey: config.recaptcha.siteKey
    };
}

module.exports = {
    verifyRecaptcha,
    getRecaptchaConfig
};
