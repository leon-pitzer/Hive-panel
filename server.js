/**
 * Hive Panel Server
 * Express.js server with session management, rate limiting, and security features
 */

require('dotenv').config();

const express = require('express');
const session = require('express-session');
const FileStore = require('session-file-store')(session);
const bodyParser = require('body-parser');
const cookieParser = require('cookie-parser');
const helmet = require('helmet');
const path = require('path');
const fs = require('fs');
const csurf = require('csurf');

// Import utilities
const { logger } = require('./html/utils/logger');
const { validateEnv, getEnvInfo } = require('./html/utils/validateEnv');
const config = require('./html/utils/config');
const { getRecaptchaConfig } = require('./html/utils/recaptcha');
const { startPeriodicCleanup } = require('./html/utils/registrationCleanup');
const { initializeDatabase } = require('./html/utils/database');

// Import middleware
const { sessionValidation } = require('./middleware/sessionValidation');
const { requirePermission } = require('./middleware/permissionCheck');

// Import routes
const authRoutes = require('./routes/auth');
const accountRoutes = require('./routes/account');
const adminRoutes = require('./routes/admin');
const absencesRoutes = require('./routes/absences');
const { ensureDefaultAdmin } = require('./routes/users');

// Validate environment variables
if (!validateEnv()) {
    logger.error('Environment validation failed. Please check your .env file.');
    process.exit(1);
}

// Create Express app
const app = express();
const PORT = process.env.PORT || 3000;

// Trust proxy (if behind reverse proxy)
app.set('trust proxy', 1);

// Security headers with Helmet
app.use(helmet(config.helmet));

// Body parser middleware
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

// Cookie parser middleware
app.use(cookieParser());

// Ensure sessions directory exists with proper error handling
const sessionsDir = path.join(__dirname, 'sessions');
try {
    if (!fs.existsSync(sessionsDir)) {
        fs.mkdirSync(sessionsDir, { recursive: true, mode: 0o755 });
        logger.info('Sessions directory created', { path: sessionsDir });
    }
    // Verify write permissions
    fs.accessSync(sessionsDir, fs.constants.W_OK | fs.constants.R_OK);
} catch (error) {
    logger.error('Failed to create or access sessions directory', { 
        error: error.message,
        path: sessionsDir 
    });
    console.error('Error: Cannot create or access sessions directory. Please check permissions.');
    process.exit(1);
}

// Session middleware with error handling
const fileStore = new FileStore({
    path: sessionsDir,
    ttl: config.session.cookie.maxAge / 1000, // Convert to seconds
    retries: 3,
    retryDelay: 100,
    reapInterval: 60 * 60, // Clean up every hour
    logFn: (error) => {
        // Custom error logging for session store
        if (error) {
            const errorStr = String(error);
            // Ignoriere ENOENT-Fehler (Session existiert nicht mehr)
            if (errorStr.includes('ENOENT') || error.code === 'ENOENT') {
                // Diese Fehler sind normal, wenn Sessions ablaufen/gelöscht werden
                return;
            }
            // Logge nur echte Fehler
            logger.error('Session file store error', { 
                error: error.message || errorStr,
                code: error.code
            });
        }
    }
});

app.use(session({
    store: fileStore,
    secret: config.session.secret,
    name: config.session.name,
    resave: config.session.resave,
    saveUninitialized: config.session.saveUninitialized,
    rolling: config.session.rolling,
    cookie: config.session.cookie
}));

// CSRF protection
const csrfProtection = csurf({ cookie: config.csrf.cookie });

// Session validation middleware
app.use(sessionValidation);

// Static files
app.use(express.static(path.join(__dirname), {
    index: false, // Don't serve index.html automatically
    setHeaders: (res, filePath) => {
        // Add security headers for static files
        if (filePath.endsWith('.html')) {
            res.setHeader('X-Content-Type-Options', 'nosniff');
            res.setHeader('X-Frame-Options', 'DENY');
        }
    }
}));

// Enforce HTTPS in production
if (process.env.NODE_ENV === 'production') {
    app.use((req, res, next) => {
        if (req.header('x-forwarded-proto') !== 'https') {
            res.redirect(`https://${req.header('host')}${req.url}`);
        } else {
            next();
        }
    });
}

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/account', accountRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/absences', absencesRoutes);

// CSRF token endpoint
app.get('/api/csrf-token', csrfProtection, (req, res) => {
    res.json({ csrfToken: req.csrfToken() });
});

// Favicon handler
app.get('/favicon.ico', (req, res) => res.status(204).end());

// reCAPTCHA config endpoint
// Legacy endpoint for backwards compatibility
app.get('/api/recaptcha-config', (req, res) => {
    const recaptchaConfig = getRecaptchaConfig();
    res.json(recaptchaConfig);
});

// New endpoint matching Flunar website
app.get('/api/recaptcha/config', (req, res) => {
    res.json(getRecaptchaConfig());
});

// Serve index.html for root
app.get('/', (req, res) => {
    // Redirect to dashboard if already authenticated and session is valid
    if (req.session && req.session.userId && req.session.lastActivity) {
        const now = Date.now();
        const inactiveTime = now - req.session.lastActivity;
        
        // Only redirect if session is still active (not timed out)
        if (inactiveTime < config.sessionTimeout.inactivityTimeout) {
            return res.redirect('/dashboard.html');
        }
    }
    res.sendFile(path.join(__dirname, 'index.html'));
});

// Protected route for dashboard
app.get('/dashboard.html', (req, res) => {
    // Check if user is authenticated
    if (!req.session || !req.session.userId) {
        return res.redirect('/');
    }
    res.sendFile(path.join(__dirname, 'dashboard.html'));
});

// Protected route for account settings
app.get('/account.html', (req, res) => {
    // Check if user is authenticated
    if (!req.session || !req.session.userId) {
        return res.redirect('/');
    }
    res.sendFile(path.join(__dirname, 'html/account.html'));
});

// Protected route for account management (admin only)
app.get('/html/admin/accounts.html', requirePermission(['manage_accounts', 'view_accounts']), (req, res) => {
    res.sendFile(path.join(__dirname, 'html/admin/accounts.html'));
});

// Protected route for absences
app.get('/html/absences.html', (req, res) => {
    // Check if user is authenticated
    if (!req.session || !req.session.userId) {
        return res.redirect('/');
    }
    res.sendFile(path.join(__dirname, 'html/absences.html'));
});

// 404 handler
app.use((req, res) => {
    res.status(404).json({ error: 'Not found' });
});

// Error handler
app.use((err, req, res, next) => {
    // Handle CSRF errors
    if (err.code === 'EBADCSRFTOKEN') {
        logger.warn('Invalid CSRF token', { ip: req.ip, path: req.path });
        return res.status(403).json({
            success: false,
            error: 'Invalid CSRF token. Please refresh the page.'
        });
    }

    logger.error('Server error:', { 
        error: err.message, 
        stack: err.stack,
        path: req.path
    });

    res.status(500).json({
        success: false,
        error: 'Ein interner Serverfehler ist aufgetreten.'
    });
});

// Start server
let server;

async function startServer() {
    try {
        // Initialize database connection and create tables
        await initializeDatabase();

        // Ensure default admin exists
        await ensureDefaultAdmin();

        // Start periodic cleanup for old registration requests
        startPeriodicCleanup();

        // Start listening
        server = app.listen(PORT, () => {
            const envInfo = getEnvInfo();
            logger.info('[Hive] Panel Server started');
            logger.info(`Environment: ${envInfo.nodeEnv}`);
            logger.info(`Port: ${PORT}`);
            logger.info(`Server URL: http://localhost:${PORT}`);
            logger.info(`reCAPTCHA: ${envInfo.recaptchaEnabled ? 'Enabled' : 'Disabled'}`);
            logger.info(`Node.js: ${envInfo.nodeVersion}`);
            
            console.log('\n' + '='.repeat(70));
            console.log('[Hive] Panel Server läuft');
            console.log(`   URL: http://localhost:${PORT}`);
            console.log(`   Umgebung: ${envInfo.nodeEnv}`);
            console.log(`   reCAPTCHA: ${envInfo.recaptchaEnabled ? '[OK] Aktiviert' : '[!] Deaktiviert'}`);
            console.log('='.repeat(70) + '\n');
        });
    } catch (error) {
        logger.error('Failed to start server:', { error: error.message });
        process.exit(1);
    }
}

// Handle uncaught exceptions
process.on('uncaughtException', (error) => {
    logger.error('Uncaught exception:', { error: error.message, stack: error.stack });
    process.exit(1);
});

// Handle unhandled promise rejections
process.on('unhandledRejection', (reason, promise) => {
    logger.error('Unhandled rejection:', { reason, promise });
    process.exit(1);
});

// Graceful shutdown
process.on('SIGTERM', () => {
    logger.info('SIGTERM signal received: closing HTTP server');
    if (server) {
        server.close(() => {
            logger.info('HTTP server closed');
            process.exit(0);
        });
    } else {
        process.exit(0);
    }
});

process.on('SIGINT', () => {
    logger.info('SIGINT signal received: closing HTTP server');
    if (server) {
        server.close(() => {
            logger.info('HTTP server closed');
            process.exit(0);
        });
    } else {
        process.exit(0);
    }
});

// Start the server
startServer();
