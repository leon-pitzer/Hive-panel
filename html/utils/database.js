/**
 * MySQL Database Connection Utility
 * Provides connection pooling and table creation for user/role/permission management
 */

const mysql = require('mysql2/promise');
const { logger } = require('./logger');

// Connection pool
let pool = null;

/**
 * Creates and configures the MySQL connection pool
 * @returns {Object} MySQL connection pool
 */
function createPool() {
    if (pool) {
        return pool;
    }

    const config = {
        host: process.env.DB_HOST,
        port: parseInt(process.env.DB_PORT, 10) || 3306,
        user: process.env.DB_USER,
        password: process.env.DB_PASSWORD,
        database: process.env.DB_NAME,
        waitForConnections: true,
        connectionLimit: 10,
        maxIdle: 10,
        idleTimeout: 60000,
        queueLimit: 0,
        enableKeepAlive: true,
        keepAliveInitialDelay: 0,
        
        // Timeout settings for remote connections
        connectTimeout: 30000,        // 30 seconds for connection establishment (default: 10000)
        
        // MariaDB compatibility
        charset: 'utf8mb4',
        timezone: process.env.DB_TIMEZONE || 'local',  // Use UTC for consistency across environments
        
        // SSL optional configuration
        // WARNING: When enabled with DB_SSL=true, this uses rejectUnauthorized=false which
        // disables certificate validation. Only use for private/trusted networks.
        // For production, configure proper SSL certificates instead.
        ssl: process.env.DB_SSL === 'true' ? { rejectUnauthorized: false } : false
    };

    pool = mysql.createPool(config);

    logger.info('MySQL connection pool created', {
        host: config.host,
        port: config.port,
        database: config.database,
        connectionLimit: config.connectionLimit,
        connectTimeout: config.connectTimeout,
        ssl: config.ssl !== false
    });

    return pool;
}

/**
 * Gets the connection pool (creates it if not exists)
 * @returns {Object} MySQL connection pool
 */
function getPool() {
    if (!pool) {
        return createPool();
    }
    return pool;
}

/**
 * Tests the database connection
 * @returns {Promise<boolean>} True if connection successful
 */
async function testConnection() {
    try {
        const connection = await getPool().getConnection();
        await connection.ping();
        connection.release();
        logger.info('[OK] Database connection successful');
        return true;
    } catch (error) {
        logger.error('Database connection failed:', { 
            error: error.message,
            code: error.code,
            sqlState: error.sqlState
        });
        return false;
    }
}

/**
 * Creates all required tables if they don't exist
 * @returns {Promise<boolean>} True if successful
 */
async function createTables() {
    const connection = await getPool().getConnection();
    
    try {
        // Start transaction
        await connection.beginTransaction();

        // Create users table
        await connection.query(`
            CREATE TABLE IF NOT EXISTS users (
                id INT AUTO_INCREMENT PRIMARY KEY,
                username VARCHAR(50) UNIQUE NOT NULL,
                password_hash VARCHAR(255) NOT NULL,
                email VARCHAR(255) DEFAULT NULL,
                display_name VARCHAR(50) DEFAULT NULL,
                role VARCHAR(20) DEFAULT 'user',
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                created_by VARCHAR(50) DEFAULT NULL,
                updated_at TIMESTAMP DEFAULT NULL,
                must_change_password BOOLEAN DEFAULT FALSE,
                INDEX idx_username (username),
                INDEX idx_role (role)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
        `);
        logger.info('Table created/verified: users');

        // Create roles table
        await connection.query(`
            CREATE TABLE IF NOT EXISTS roles (
                id VARCHAR(50) PRIMARY KEY,
                name VARCHAR(100) NOT NULL,
                description TEXT DEFAULT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                created_by VARCHAR(50) DEFAULT NULL,
                updated_at TIMESTAMP DEFAULT NULL,
                updated_by VARCHAR(50) DEFAULT NULL,
                INDEX idx_name (name)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
        `);
        logger.info('Table created/verified: roles');

        // Create permissions table
        await connection.query(`
            CREATE TABLE IF NOT EXISTS permissions (
                id INT AUTO_INCREMENT PRIMARY KEY,
                name VARCHAR(50) UNIQUE NOT NULL,
                description TEXT DEFAULT NULL,
                INDEX idx_name (name)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
        `);
        logger.info('Table created/verified: permissions');

        // Create user_permissions junction table
        await connection.query(`
            CREATE TABLE IF NOT EXISTS user_permissions (
                user_id INT NOT NULL,
                permission_id INT NOT NULL,
                PRIMARY KEY (user_id, permission_id),
                FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
                FOREIGN KEY (permission_id) REFERENCES permissions(id) ON DELETE CASCADE
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
        `);
        logger.info('Table created/verified: user_permissions');

        // Create role_permissions junction table
        await connection.query(`
            CREATE TABLE IF NOT EXISTS role_permissions (
                role_id VARCHAR(50) NOT NULL,
                permission_id INT NOT NULL,
                PRIMARY KEY (role_id, permission_id),
                FOREIGN KEY (role_id) REFERENCES roles(id) ON DELETE CASCADE,
                FOREIGN KEY (permission_id) REFERENCES permissions(id) ON DELETE CASCADE
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
        `);
        logger.info('Table created/verified: role_permissions');

        // Create user_roles junction table
        await connection.query(`
            CREATE TABLE IF NOT EXISTS user_roles (
                user_id INT NOT NULL,
                role_id VARCHAR(50) NOT NULL,
                PRIMARY KEY (user_id, role_id),
                FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
                FOREIGN KEY (role_id) REFERENCES roles(id) ON DELETE CASCADE
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
        `);
        logger.info('Table created/verified: user_roles');

        // Create registration_requests table (for user registration feature)
        await connection.query(`
            CREATE TABLE IF NOT EXISTS registration_requests (
                id VARCHAR(50) PRIMARY KEY,
                username VARCHAR(50) NOT NULL,
                email VARCHAR(255) NOT NULL,
                password_hash VARCHAR(255) NOT NULL,
                status VARCHAR(20) DEFAULT 'pending',
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                ip VARCHAR(45) DEFAULT NULL,
                rejection_reason TEXT DEFAULT NULL,
                rejected_at TIMESTAMP DEFAULT NULL,
                rejected_by VARCHAR(50) DEFAULT NULL,
                INDEX idx_username (username),
                INDEX idx_status (status)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
        `);
        logger.info('Table created/verified: registration_requests');

        // Create absences table (for absence/vacation management)
        await connection.query(`
            CREATE TABLE IF NOT EXISTS absences (
                id INT AUTO_INCREMENT PRIMARY KEY,
                user_id INT NOT NULL,
                start_date DATE NOT NULL,
                end_date DATE NOT NULL,
                start_time TIME NULL,
                end_time TIME NULL,
                reason TEXT NOT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
                INDEX idx_user_id (user_id),
                INDEX idx_dates (start_date, end_date)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
        `);
        logger.info('Table created/verified: absences');

        // Insert default permissions if they don't exist
        const defaultPermissions = [
            { name: 'manage_accounts', description: 'Create, edit, and delete user accounts' },
            { name: 'view_accounts', description: 'View user accounts' },
            { name: 'manage_roles', description: 'Create, edit, and delete roles' },
            { name: 'handle_requests', description: 'Approve or reject registration requests' },
            { name: 'admin_all', description: 'Full administrative access (legacy)' },
            { name: 'view_absences', description: 'View all absences' },
            { name: 'manage_absences', description: 'Manage and delete any absences' }
        ];

        for (const perm of defaultPermissions) {
            await connection.query(
                'INSERT IGNORE INTO permissions (name, description) VALUES (?, ?)',
                [perm.name, perm.description]
            );
        }
        logger.info('Default permissions inserted/verified');

        // Commit transaction
        await connection.commit();
        logger.info('[OK] All database tables created/verified successfully');
        
        return true;
    } catch (error) {
        // Rollback on error
        await connection.rollback();
        logger.error('Error creating tables:', { 
            error: error.message,
            code: error.code,
            sqlState: error.sqlState
        });
        throw error;
    } finally {
        connection.release();
    }
}

/**
 * Initializes the database (creates pool, tests connection, creates tables)
 * @returns {Promise<boolean>} True if successful
 */
async function initializeDatabase() {
    try {
        // Create pool
        createPool();

        // Test connection
        const connected = await testConnection();
        if (!connected) {
            throw new Error('Database connection test failed');
        }

        // Create tables
        await createTables();

        logger.info('[OK] Database initialized successfully');
        return true;
    } catch (error) {
        logger.error('Database initialization failed:', { error: error.message });
        throw error;
    }
}

/**
 * Closes the connection pool
 * @returns {Promise<void>}
 */
async function closePool() {
    if (pool) {
        await pool.end();
        pool = null;
        logger.info('Database connection pool closed');
    }
}

module.exports = {
    getPool,
    createPool,
    testConnection,
    createTables,
    initializeDatabase,
    closePool
};
