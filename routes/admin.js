/**
 * Admin routes
 * Handles administrative functions: user management, role management, registration requests
 */

const express = require('express');
const { body, validationResult } = require('express-validator');
const bcrypt = require('bcrypt');
const path = require('path');
const crypto = require('crypto');
const { readJsonFile, writeJsonFile, updateJsonFile } = require('../html/utils/fileOperations');
const { logger, securityLogger } = require('../html/utils/logger');
const { requirePermission } = require('../middleware/permissionCheck');
const { hasWildcard } = require('../html/utils/permissions');
const { getUserByUsername, generateSecurePassword } = require('./users');
const { getPool } = require('../html/utils/database');

const router = express.Router();
const USERS_FILE = path.join(__dirname, '../data/users.json');
const ROLES_FILE = path.join(__dirname, '../data/roles.json');
const REQUESTS_FILE = path.join(__dirname, '../data/registration-requests.json');

/**
 * GET /api/admin/accounts
 * List all accounts (requires: manage_accounts or view_accounts)
 */
router.get('/accounts', requirePermission(['manage_accounts', 'view_accounts']), async (req, res) => {
    try {
        const pool = getPool();
        
        // Get all users with their permissions and roles
        const [users] = await pool.query(
            `SELECT 
                u.id,
                u.username,
                u.email,
                u.display_name AS displayName,
                u.role,
                u.created_at AS createdAt,
                u.created_by AS createdBy,
                u.updated_at AS updatedAt,
                u.must_change_password AS mustChangePassword
            FROM users u
            ORDER BY u.created_at DESC`
        );

        // Get permissions and roles for each user
        for (const user of users) {
            // Get direct permissions
            const [permRows] = await pool.query(
                `SELECT p.name
                FROM user_permissions up
                JOIN permissions p ON up.permission_id = p.id
                WHERE up.user_id = ?`,
                [user.id]
            );
            user.permissions = permRows.map(row => row.name);

            // Get user roles
            const [roleRows] = await pool.query(
                `SELECT ur.role_id
                FROM user_roles ur
                WHERE ur.user_id = ?`,
                [user.id]
            );
            user.roles = roleRows.map(row => row.role_id);

            // Remove sensitive data and add censored email
            user.emailCensored = user.email ? '***@***.***' : null;
            user.hasPassword = true;
            delete user.email;
        }

        res.json({
            success: true,
            accounts: users
        });
    } catch (error) {
        logger.error('Error listing accounts from database:', { error: error.message });
        res.status(500).json({
            success: false,
            error: 'Fehler beim Laden der Accounts.'
        });
    }
});

/**
 * GET /api/admin/accounts/:username
 * Get single account with details (requires: manage_accounts or view_accounts)
 */
router.get('/accounts/:username', requirePermission(['manage_accounts', 'view_accounts']), async (req, res) => {
    try {
        const { username } = req.params;
        
        // TODO: Replace with MySQL query in future
        // SELECT * FROM users WHERE username = ?
        const user = await getUserByUsername(username);
        
        if (!user) {
            return res.status(404).json({
                success: false,
                error: 'Account nicht gefunden.'
            });
        }
        
        // Remove password hash
        const { passwordHash, ...safeUser } = user;
        
        res.json({
            success: true,
            account: {
                ...safeUser,
                emailCensored: user.email ? '***@***.***' : null,
                hasPassword: !!passwordHash
            }
        });
    } catch (error) {
        logger.error('Error getting account:', { error: error.message, username: req.params.username });
        res.status(500).json({
            success: false,
            error: 'Fehler beim Laden des Accounts.'
        });
    }
});

/**
 * POST /api/admin/accounts
 * Create new account (requires: manage_accounts)
 */
router.post('/accounts',
    requirePermission('manage_accounts'),
    [
        body('username').trim().notEmpty().matches(/^[a-zA-Z0-9_-]+$/).isLength({ min: 3, max: 30 }),
        body('email').optional().isEmail(),
        body('password').optional().isLength({ min: 8 }),
        body('role').optional().trim(),
        body('permissions').optional().isArray(),
        body('roles').optional().isArray(),
        body('displayName').optional().trim().isLength({ max: 50 })
    ],
    async (req, res) => {
        let connection;
        
        try {
            connection = await getPool().getConnection();
            
            // Validate input
            const errors = validationResult(req);
            if (!errors.isEmpty()) {
                return res.status(400).json({
                    success: false,
                    error: 'Ungültige Eingabe',
                    errors: errors.array()
                });
            }
            
            const { username, email, password, role, permissions, roles, displayName } = req.body;
            
            // Check if user already exists
            const existingUser = await getUserByUsername(username);
            if (existingUser) {
                return res.status(409).json({
                    success: false,
                    error: 'Benutzername bereits vergeben.'
                });
            }
            
            // Check if creator can assign wildcard
            const creator = await getUserByUsername(req.session.username);
            if (permissions && permissions.includes('*') && !hasWildcard(creator)) {
                securityLogger.warn('Attempt to assign wildcard without permission', {
                    admin: req.session.username,
                    targetUser: username
                });
                return res.status(403).json({
                    success: false,
                    error: 'Nur Benutzer mit Wildcard-Berechtigung können die Wildcard-Berechtigung vergeben.'
                });
            }
            
            // Generate password if not provided
            const userPassword = password || generateSecurePassword();
            const generatedPassword = !password;
            
            // Hash password
            const salt = await bcrypt.genSalt(10);
            const passwordHash = await bcrypt.hash(userPassword, salt);

            // Start transaction
            await connection.beginTransaction();

            // Insert user
            const [result] = await connection.query(
                `INSERT INTO users (username, password_hash, email, display_name, role, created_by)
                VALUES (?, ?, ?, ?, ?, ?)`,
                [username.trim(), passwordHash, email || null, displayName || null, role || 'user', req.session.username]
            );

            const userId = result.insertId;

            // Insert direct permissions
            if (permissions && permissions.length > 0) {
                for (const permName of permissions) {
                    const [permRows] = await connection.query(
                        'SELECT id FROM permissions WHERE name = ? LIMIT 1',
                        [permName]
                    );
                    
                    if (permRows.length > 0) {
                        await connection.query(
                            'INSERT INTO user_permissions (user_id, permission_id) VALUES (?, ?)',
                            [userId, permRows[0].id]
                        );
                    }
                }
            }

            // Insert user roles
            if (roles && roles.length > 0) {
                for (const roleId of roles) {
                    const [roleRows] = await connection.query(
                        'SELECT id FROM roles WHERE id = ? LIMIT 1',
                        [roleId]
                    );
                    
                    if (roleRows.length > 0) {
                        await connection.query(
                            'INSERT INTO user_roles (user_id, role_id) VALUES (?, ?)',
                            [userId, roleId]
                        );
                    }
                }
            }

            // Commit transaction
            await connection.commit();

            securityLogger.info('Account created by admin', {
                admin: req.session.username,
                newUser: username,
                role: role || 'user',
                permissions: permissions || []
            });

            res.json({
                success: true,
                message: 'Account erfolgreich erstellt.',
                generatedPassword: generatedPassword ? userPassword : undefined
            });
        } catch (error) {
            // Rollback on error
            if (connection) {
                await connection.rollback();
            }
            logger.error('Error creating account in database:', { error: error.message });
            res.status(500).json({
                success: false,
                error: 'Fehler beim Erstellen des Accounts.'
            });
        } finally {
            if (connection) {
                connection.release();
            }
        }
    }
);

/**
 * PUT /api/admin/accounts/:username
 * Update account (requires: manage_accounts)
 */
router.put('/accounts/:username',
    requirePermission('manage_accounts'),
    [
        body('email').optional().isEmail(),
        body('newPassword').optional().isLength({ min: 8 }),
        body('role').optional().trim(),
        body('permissions').optional().isArray(),
        body('roles').optional().isArray(),
        body('displayName').optional().trim().isLength({ max: 50 })
    ],
    async (req, res) => {
        let connection;
        
        try {
            connection = await getPool().getConnection();
            
            // Validate input
            const errors = validationResult(req);
            if (!errors.isEmpty()) {
                return res.status(400).json({
                    success: false,
                    error: 'Ungültige Eingabe',
                    errors: errors.array()
                });
            }
            
            const { username } = req.params;
            const { email, newPassword, role, permissions, roles, displayName } = req.body;
            
            // Check if user exists
            const existingUser = await getUserByUsername(username);
            if (!existingUser) {
                return res.status(404).json({
                    success: false,
                    error: 'Account nicht gefunden.'
                });
            }
            
            // Check if editor can assign wildcard
            const editor = await getUserByUsername(req.session.username);
            if (permissions && permissions.includes('*') && !hasWildcard(editor)) {
                securityLogger.warn('Attempt to assign wildcard without permission', {
                    admin: req.session.username,
                    targetUser: username
                });
                return res.status(403).json({
                    success: false,
                    error: 'Nur Benutzer mit Wildcard-Berechtigung können die Wildcard-Berechtigung vergeben.'
                });
            }

            // Start transaction
            await connection.beginTransaction();

            // Build UPDATE query
            const updates = [];
            const values = [];

            if (email !== undefined) {
                updates.push('email = ?');
                values.push(email);
            }
            if (role !== undefined) {
                updates.push('role = ?');
                values.push(role);
            }
            if (displayName !== undefined) {
                updates.push('display_name = ?');
                values.push(displayName);
            }
            if (newPassword) {
                const salt = await bcrypt.genSalt(10);
                const passwordHash = await bcrypt.hash(newPassword, salt);
                updates.push('password_hash = ?');
                values.push(passwordHash);
            }

            // Always update timestamp
            updates.push('updated_at = CURRENT_TIMESTAMP');

            // Update user if there are changes
            if (updates.length > 1) { // More than just timestamp
                values.push(existingUser.id);
                await connection.query(
                    `UPDATE users SET ${updates.join(', ')} WHERE id = ?`,
                    values
                );
            }

            // Update permissions if provided
            if (permissions !== undefined) {
                // Delete existing permissions
                await connection.query(
                    'DELETE FROM user_permissions WHERE user_id = ?',
                    [existingUser.id]
                );

                // Insert new permissions
                for (const permName of permissions) {
                    const [permRows] = await connection.query(
                        'SELECT id FROM permissions WHERE name = ? LIMIT 1',
                        [permName]
                    );
                    
                    if (permRows.length > 0) {
                        await connection.query(
                            'INSERT INTO user_permissions (user_id, permission_id) VALUES (?, ?)',
                            [existingUser.id, permRows[0].id]
                        );
                    }
                }
            }

            // Update roles if provided
            if (roles !== undefined) {
                // Delete existing roles
                await connection.query(
                    'DELETE FROM user_roles WHERE user_id = ?',
                    [existingUser.id]
                );

                // Insert new roles
                for (const roleId of roles) {
                    const [roleRows] = await connection.query(
                        'SELECT id FROM roles WHERE id = ? LIMIT 1',
                        [roleId]
                    );
                    
                    if (roleRows.length > 0) {
                        await connection.query(
                            'INSERT INTO user_roles (user_id, role_id) VALUES (?, ?)',
                            [existingUser.id, roleId]
                        );
                    }
                }
            }

            // Commit transaction
            await connection.commit();

            securityLogger.info('Account updated by admin', {
                admin: req.session.username,
                updatedUser: username,
                updates: Object.keys(req.body)
            });

            res.json({
                success: true,
                message: 'Account erfolgreich aktualisiert.'
            });
        } catch (error) {
            // Rollback on error
            if (connection) {
                await connection.rollback();
            }
            logger.error('Error updating account in database:', { 
                error: error.message, 
                username: req.params.username 
            });
            res.status(500).json({
                success: false,
                error: 'Fehler beim Aktualisieren des Accounts.'
            });
        } finally {
            if (connection) {
                connection.release();
            }
        }
    }
);

/**
 * DELETE /api/admin/accounts/:username
 * Delete account (requires: manage_accounts)
 */
router.delete('/accounts/:username', requirePermission('manage_accounts'), async (req, res) => {
    let connection;
    
    try {
        connection = await getPool().getConnection();
        
        const { username } = req.params;
        
        // Check if user exists
        const user = await getUserByUsername(username);
        if (!user) {
            return res.status(404).json({
                success: false,
                error: 'Account nicht gefunden.'
            });
        }
        
        // Prevent deleting own account
        if (username === req.session.username) {
            return res.status(400).json({
                success: false,
                error: 'Sie können Ihren eigenen Account nicht löschen.'
            });
        }
        
        // Check if this is the last admin with wildcard
        if (hasWildcard(user)) {
            const pool = getPool();
            const [wildcardAdmins] = await pool.query(
                `SELECT COUNT(*) AS count
                FROM users u
                LEFT JOIN user_permissions up ON u.id = up.user_id
                LEFT JOIN permissions p ON up.permission_id = p.id
                WHERE p.name = '*'`
            );
            
            if (wildcardAdmins[0].count === 1) {
                return res.status(400).json({
                    success: false,
                    error: 'Der letzte Administrator mit Wildcard-Berechtigung kann nicht gelöscht werden.'
                });
            }
        }

        // Start transaction
        await connection.beginTransaction();

        // Delete user (CASCADE will handle permissions and roles)
        await connection.query(
            'DELETE FROM users WHERE id = ?',
            [user.id]
        );

        // Commit transaction
        await connection.commit();

        securityLogger.info('Account deleted by admin', {
            admin: req.session.username,
            deletedUser: username
        });

        res.json({
            success: true,
            message: 'Account erfolgreich gelöscht.'
        });
    } catch (error) {
        // Rollback on error
        if (connection) {
            await connection.rollback();
        }
        logger.error('Error deleting account from database:', { 
            error: error.message, 
            username: req.params.username 
        });
        res.status(500).json({
            success: false,
            error: 'Fehler beim Löschen des Accounts.'
        });
    } finally {
        if (connection) {
            connection.release();
        }
    }
});

/**
 * GET /api/admin/roles
 * Get all roles (requires: manage_roles)
 */
router.get('/roles', requirePermission('manage_roles'), async (req, res) => {
    try {
        const pool = getPool();
        
        // Get all roles
        const [roles] = await pool.query(
            `SELECT id, name, description, created_at AS createdAt, created_by AS createdBy,
                    updated_at AS updatedAt, updated_by AS updatedBy
            FROM roles
            ORDER BY name`
        );

        // Get permissions for each role
        for (const role of roles) {
            const [permRows] = await pool.query(
                `SELECT p.name
                FROM role_permissions rp
                JOIN permissions p ON rp.permission_id = p.id
                WHERE rp.role_id = ?`,
                [role.id]
            );
            role.permissions = permRows.map(row => row.name);
        }

        res.json({
            success: true,
            roles: roles
        });
    } catch (error) {
        logger.error('Error listing roles from database:', { error: error.message });
        res.status(500).json({
            success: false,
            error: 'Fehler beim Laden der Rollen.'
        });
    }
});

/**
 * POST /api/admin/roles
 * Create new role (requires: manage_roles)
 */
router.post('/roles',
    requirePermission('manage_roles'),
    [
        body('name').trim().notEmpty().isLength({ min: 3, max: 50 }),
        body('permissions').isArray(),
        body('description').optional().trim()
    ],
    async (req, res) => {
        let connection;
        
        try {
            connection = await getPool().getConnection();
            
            // Validate input
            const errors = validationResult(req);
            if (!errors.isEmpty()) {
                return res.status(400).json({
                    success: false,
                    error: 'Ungültige Eingabe',
                    errors: errors.array()
                });
            }
            
            const { name, permissions, description } = req.body;
            
            // Generate unique role ID
            const roleId = `role-${crypto.randomBytes(8).toString('hex')}`;

            // Start transaction
            await connection.beginTransaction();

            // Insert role
            await connection.query(
                `INSERT INTO roles (id, name, description, created_by)
                VALUES (?, ?, ?, ?)`,
                [roleId, name.trim(), description || null, req.session.username]
            );

            // Insert role permissions
            if (permissions && permissions.length > 0) {
                for (const permName of permissions) {
                    const [permRows] = await connection.query(
                        'SELECT id FROM permissions WHERE name = ? LIMIT 1',
                        [permName]
                    );
                    
                    if (permRows.length > 0) {
                        await connection.query(
                            'INSERT INTO role_permissions (role_id, permission_id) VALUES (?, ?)',
                            [roleId, permRows[0].id]
                        );
                    }
                }
            }

            // Commit transaction
            await connection.commit();

            securityLogger.info('Role created by admin', {
                admin: req.session.username,
                roleId,
                roleName: name,
                permissions
            });

            res.json({
                success: true,
                message: 'Rolle erfolgreich erstellt.',
                role: {
                    id: roleId,
                    name: name.trim(),
                    description: description || null,
                    permissions: permissions || [],
                    createdBy: req.session.username
                }
            });
        } catch (error) {
            // Rollback on error
            if (connection) {
                await connection.rollback();
            }
            logger.error('Error creating role in database:', { error: error.message });
            res.status(500).json({
                success: false,
                error: 'Fehler beim Erstellen der Rolle.'
            });
        } finally {
            if (connection) {
                connection.release();
            }
        }
    }
);

/**
 * PUT /api/admin/roles/:id
 * Update role (requires: manage_roles)
 */
router.put('/roles/:id',
    requirePermission('manage_roles'),
    [
        body('name').optional().trim().isLength({ min: 3, max: 50 }),
        body('permissions').optional().isArray(),
        body('description').optional().trim()
    ],
    async (req, res) => {
        let connection;
        
        try {
            connection = await getPool().getConnection();
            
            // Validate input
            const errors = validationResult(req);
            if (!errors.isEmpty()) {
                return res.status(400).json({
                    success: false,
                    error: 'Ungültige Eingabe',
                    errors: errors.array()
                });
            }
            
            const { id } = req.params;
            const { name, permissions, description } = req.body;

            // Start transaction
            await connection.beginTransaction();

            // Check if role exists
            const [existingRole] = await connection.query(
                'SELECT id FROM roles WHERE id = ? LIMIT 1',
                [id]
            );

            if (existingRole.length === 0) {
                if (connection) {
                    await connection.rollback();
                }
                return res.status(404).json({
                    success: false,
                    error: 'Rolle nicht gefunden.'
                });
            }

            // Build UPDATE query
            const updates = [];
            const values = [];

            if (name !== undefined) {
                updates.push('name = ?');
                values.push(name);
            }
            if (description !== undefined) {
                updates.push('description = ?');
                values.push(description);
            }

            // Always update timestamp and updater
            updates.push('updated_at = CURRENT_TIMESTAMP');
            updates.push('updated_by = ?');
            values.push(req.session.username);

            // Update role if there are changes
            if (updates.length > 2) { // More than just timestamp and updater
                values.push(id);
                await connection.query(
                    `UPDATE roles SET ${updates.join(', ')} WHERE id = ?`,
                    values
                );
            }

            // Update permissions if provided
            if (permissions !== undefined) {
                // Delete existing permissions
                await connection.query(
                    'DELETE FROM role_permissions WHERE role_id = ?',
                    [id]
                );

                // Insert new permissions
                for (const permName of permissions) {
                    const [permRows] = await connection.query(
                        'SELECT id FROM permissions WHERE name = ? LIMIT 1',
                        [permName]
                    );
                    
                    if (permRows.length > 0) {
                        await connection.query(
                            'INSERT INTO role_permissions (role_id, permission_id) VALUES (?, ?)',
                            [id, permRows[0].id]
                        );
                    }
                }
            }

            // Commit transaction
            await connection.commit();

            securityLogger.info('Role updated by admin', {
                admin: req.session.username,
                roleId: id,
                updates: { name, permissions, description }
            });

            res.json({
                success: true,
                message: 'Rolle erfolgreich aktualisiert.'
            });
        } catch (error) {
            // Rollback on error
            if (connection) {
                await connection.rollback();
            }
            logger.error('Error updating role in database:', { 
                error: error.message, 
                roleId: req.params.id 
            });
            res.status(500).json({
                success: false,
                error: 'Fehler beim Aktualisieren der Rolle.'
            });
        } finally {
            if (connection) {
                connection.release();
            }
        }
    }
);

/**
 * DELETE /api/admin/roles/:id
 * Delete role (requires: manage_roles)
 */
router.delete('/roles/:id', requirePermission('manage_roles'), async (req, res) => {
    let connection;
    
    try {
        connection = await getPool().getConnection();
        
        const { id } = req.params;
        const pool = getPool();
        
        // Check if role is in use
        const [usersWithRole] = await pool.query(
            `SELECT COUNT(*) AS count
            FROM user_roles
            WHERE role_id = ?`,
            [id]
        );

        if (usersWithRole[0].count > 0) {
            return res.status(400).json({
                success: false,
                error: `Diese Rolle wird noch von ${usersWithRole[0].count} Benutzer(n) verwendet und kann nicht gelöscht werden.`
            });
        }

        // Start transaction
        await connection.beginTransaction();

        // Delete role (CASCADE will handle permissions)
        const [result] = await connection.query(
            'DELETE FROM roles WHERE id = ?',
            [id]
        );

        if (result.affectedRows === 0) {
            if (connection) {
                await connection.rollback();
            }
            return res.status(404).json({
                success: false,
                error: 'Rolle nicht gefunden.'
            });
        }

        // Commit transaction
        await connection.commit();

        securityLogger.info('Role deleted by admin', {
            admin: req.session.username,
            roleId: id
        });

        res.json({
            success: true,
            message: 'Rolle erfolgreich gelöscht.'
        });
    } catch (error) {
        // Rollback on error
        if (connection) {
            await connection.rollback();
        }
        logger.error('Error deleting role from database:', { 
            error: error.message, 
            roleId: req.params.id 
        });
        res.status(500).json({
            success: false,
            error: 'Fehler beim Löschen der Rolle.'
        });
    } finally {
        if (connection) {
            connection.release();
        }
    }
});

/**
 * GET /api/admin/registration-requests
 * List all registration requests (requires: handle_requests or manage_accounts)
 */
router.get('/registration-requests', requirePermission(['handle_requests', 'manage_accounts']), async (req, res) => {
    try {
        const pool = getPool();
        
        // Get all registration requests (no password hashes)
        const [requests] = await pool.query(
            `SELECT id, username, email, status, created_at AS createdAt, ip,
                    rejection_reason AS rejectionReason, rejected_at AS rejectedAt,
                    rejected_by AS rejectedBy
            FROM registration_requests
            ORDER BY created_at DESC`
        );

        res.json({
            success: true,
            requests: requests
        });
    } catch (error) {
        logger.error('Error listing registration requests from database:', { error: error.message });
        res.status(500).json({
            success: false,
            error: 'Fehler beim Laden der Registrierungsanfragen.'
        });
    }
});

/**
 * GET /api/admin/registration-requests/count
 * Get count of pending registration requests (requires: handle_requests or manage_accounts)
 */
router.get('/registration-requests/count', requirePermission(['handle_requests', 'manage_accounts']), async (req, res) => {
    try {
        const pool = getPool();
        
        const [result] = await pool.query(
            `SELECT COUNT(*) AS count
            FROM registration_requests
            WHERE status = 'pending'`
        );

        res.json({
            success: true,
            count: result[0].count
        });
    } catch (error) {
        logger.error('Error getting registration requests count from database:', { error: error.message });
        res.status(500).json({
            success: false,
            error: 'Fehler beim Zählen der Anfragen.'
        });
    }
});

/**
 * POST /api/admin/registration-requests/:id/approve
 * Approve a registration request (requires: handle_requests or manage_accounts)
 */
router.post('/registration-requests/:id/approve', requirePermission(['handle_requests', 'manage_accounts']), async (req, res) => {
    let connection;
    
    try {
        connection = await getPool().getConnection();
        
        const { id } = req.params;
        const pool = getPool();
        
        // Find the request
        const [requests] = await pool.query(
            `SELECT id, username, email, password_hash AS passwordHash, status
            FROM registration_requests
            WHERE id = ?
            LIMIT 1`,
            [id]
        );

        if (requests.length === 0) {
            return res.status(404).json({
                success: false,
                error: 'Registrierungsanfrage nicht gefunden.'
            });
        }

        const request = requests[0];

        if (request.status !== 'pending') {
            return res.status(400).json({
                success: false,
                error: 'Diese Anfrage wurde bereits bearbeitet.'
            });
        }

        // Check if username already exists (in case it was created in the meantime)
        const existingUser = await getUserByUsername(request.username);
        if (existingUser) {
            return res.status(409).json({
                success: false,
                error: 'Benutzername ist bereits vergeben.'
            });
        }

        // Start transaction
        await connection.beginTransaction();

        // Create user account
        const [result] = await connection.query(
            `INSERT INTO users (username, email, password_hash, role, created_by)
            VALUES (?, ?, ?, 'user', ?)`,
            [request.username, request.email, request.passwordHash, req.session.username]
        );

        // Delete the registration request
        await connection.query(
            'DELETE FROM registration_requests WHERE id = ?',
            [id]
        );

        // Commit transaction
        await connection.commit();

        securityLogger.info('Registration request approved', {
            admin: req.session.username,
            requestId: id,
            username: request.username
        });

        res.json({
            success: true,
            message: 'Registrierungsanfrage erfolgreich genehmigt.'
        });
    } catch (error) {
        // Rollback on error
        if (connection) {
            await connection.rollback();
        }
        logger.error('Error approving registration request in database:', { 
            error: error.message, 
            requestId: req.params.id 
        });
        res.status(500).json({
            success: false,
            error: 'Fehler beim Genehmigen der Anfrage.'
        });
    } finally {
        if (connection) {
            connection.release();
        }
    }
});

/**
 * POST /api/admin/registration-requests/:id/reject
 * Reject a registration request (requires: handle_requests or manage_accounts)
 */
router.post('/registration-requests/:id/reject',
    requirePermission(['handle_requests', 'manage_accounts']),
    [
        body('reason').optional().trim().isLength({ max: 500 })
    ],
    async (req, res) => {
        try {
            // Validate input
            const errors = validationResult(req);
            if (!errors.isEmpty()) {
                return res.status(400).json({
                    success: false,
                    error: 'Ungültige Eingabe',
                    errors: errors.array()
                });
            }
            
            const { id } = req.params;
            const { reason } = req.body;
            const pool = getPool();

            // Update request status
            const [result] = await pool.query(
                `UPDATE registration_requests
                SET status = 'rejected',
                    rejected_at = CURRENT_TIMESTAMP,
                    rejected_by = ?,
                    rejection_reason = ?
                WHERE id = ?`,
                [req.session.username, reason || null, id]
            );

            if (result.affectedRows === 0) {
                return res.status(404).json({
                    success: false,
                    error: 'Registrierungsanfrage nicht gefunden.'
                });
            }

            securityLogger.info('Registration request rejected', {
                admin: req.session.username,
                requestId: id,
                reason: reason || 'No reason provided'
            });

            res.json({
                success: true,
                message: 'Registrierungsanfrage erfolgreich abgelehnt.'
            });
        } catch (error) {
            logger.error('Error rejecting registration request in database:', { 
                error: error.message, 
                requestId: req.params.id 
            });
            res.status(500).json({
                success: false,
                error: 'Fehler beim Ablehnen der Anfrage.'
            });
        }
    }
);

module.exports = router;
