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

// Import middleware
const { sessionValidation } = require('./middleware/sessionValidation');

// Import routes
const authRoutes = require('./routes/auth');
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

// Ensure sessions directory exists
const sessionsDir = path.join(__dirname, 'sessions');
if (!fs.existsSync(sessionsDir)) {
    fs.mkdirSync(sessionsDir, { recursive: true });
}

// Session middleware
app.use(session({
    store: new FileStore({
        path: sessionsDir,
        ttl: config.session.cookie.maxAge / 1000, // Convert to seconds
        retries: 3,
        reapInterval: 60 * 60 // Clean up every hour
    }),
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

// CSRF token endpoint
app.get('/api/csrf-token', csrfProtection, (req, res) => {
    res.json({ csrfToken: req.csrfToken() });
});

// reCAPTCHA config endpoint
app.get('/api/recaptcha-config', (req, res) => {
    res.json(getRecaptchaConfig());
});

// Serve index.html for root
app.get('/', (req, res) => {
    // Redirect to dashboard if already authenticated
    if (req.session && req.session.userId) {
        return res.redirect('/dashboard.html');
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
        // Ensure default admin exists
        await ensureDefaultAdmin();

        // Start listening
        server = app.listen(PORT, () => {
            const envInfo = getEnvInfo();
            logger.info('🐝 Hive Panel Server started');
            logger.info(`Environment: ${envInfo.nodeEnv}`);
            logger.info(`Port: ${PORT}`);
            logger.info(`Server URL: http://localhost:${PORT}`);
            logger.info(`reCAPTCHA: ${envInfo.recaptchaEnabled ? 'Enabled' : 'Disabled'}`);
            logger.info(`Node.js: ${envInfo.nodeVersion}`);
            
            console.log('\n' + '='.repeat(70));
            console.log('🐝 Hive Panel Server läuft');
            console.log(`   URL: http://localhost:${PORT}`);
            console.log(`   Umgebung: ${envInfo.nodeEnv}`);
            console.log(`   reCAPTCHA: ${envInfo.recaptchaEnabled ? '✅ Aktiviert' : '⚠️  Deaktiviert'}`);
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
