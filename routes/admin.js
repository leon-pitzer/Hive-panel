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
        // TODO: Replace with MySQL query in future
        // SELECT username, email, role, permissions, roles, createdAt FROM users ORDER BY createdAt DESC
        const users = await readJsonFile(USERS_FILE, []);
        
        // Remove password hashes from response
        const safeUsers = users.map(user => {
            const { passwordHash, ...safeUser } = user;
            return {
                ...safeUser,
                emailCensored: user.email ? '***@***.***' : null,
                hasPassword: !!passwordHash
            };
        });
        
        res.json({
            success: true,
            accounts: safeUsers
        });
    } catch (error) {
        logger.error('Error listing accounts:', { error: error.message });
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
            
            // Create user object
            const newUser = {
                username: username.trim(),
                passwordHash: passwordHash,
                email: email || null,
                displayName: displayName || null,
                role: role || 'user',
                permissions: permissions || [],
                roles: roles || [],
                createdAt: new Date().toISOString(),
                createdBy: req.session.username
            };
            
            // Add to users file
            const success = await updateJsonFile(USERS_FILE, (users) => {
                users.push(newUser);
                return users;
            }, []);
            
            if (success) {
                securityLogger.info('Account created by admin', {
                    admin: req.session.username,
                    newUser: username,
                    role: newUser.role,
                    permissions: newUser.permissions
                });
                
                res.json({
                    success: true,
                    message: 'Account erfolgreich erstellt.',
                    generatedPassword: generatedPassword ? userPassword : undefined
                });
            } else {
                throw new Error('Failed to save user');
            }
        } catch (error) {
            logger.error('Error creating account:', { error: error.message });
            res.status(500).json({
                success: false,
                error: 'Fehler beim Erstellen des Accounts.'
            });
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
            
            // Prepare updates
            const updates = {};
            if (email !== undefined) updates.email = email;
            if (role !== undefined) updates.role = role;
            if (permissions !== undefined) updates.permissions = permissions;
            if (roles !== undefined) updates.roles = roles;
            if (displayName !== undefined) updates.displayName = displayName;
            
            // Hash new password if provided
            if (newPassword) {
                const salt = await bcrypt.genSalt(10);
                updates.passwordHash = await bcrypt.hash(newPassword, salt);
            }
            
            // Update user
            const success = await updateJsonFile(USERS_FILE, (users) => {
                const userIndex = users.findIndex(u => u.username === username);
                if (userIndex !== -1) {
                    users[userIndex] = { ...users[userIndex], ...updates };
                }
                return users;
            }, []);
            
            if (success) {
                securityLogger.info('Account updated by admin', {
                    admin: req.session.username,
                    updatedUser: username,
                    updates: Object.keys(updates)
                });
                
                res.json({
                    success: true,
                    message: 'Account erfolgreich aktualisiert.'
                });
            } else {
                throw new Error('Failed to update user');
            }
        } catch (error) {
            logger.error('Error updating account:', { error: error.message, username: req.params.username });
            res.status(500).json({
                success: false,
                error: 'Fehler beim Aktualisieren des Accounts.'
            });
        }
    }
);

/**
 * DELETE /api/admin/accounts/:username
 * Delete account (requires: manage_accounts)
 */
router.delete('/accounts/:username', requirePermission('manage_accounts'), async (req, res) => {
    try {
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
            const users = await readJsonFile(USERS_FILE, []);
            const wildcardAdmins = users.filter(u => u.permissions && u.permissions.includes('*'));
            
            if (wildcardAdmins.length === 1) {
                return res.status(400).json({
                    success: false,
                    error: 'Der letzte Administrator mit Wildcard-Berechtigung kann nicht gelöscht werden.'
                });
            }
        }
        
        // Delete user
        const success = await updateJsonFile(USERS_FILE, (users) => {
            return users.filter(u => u.username !== username);
        }, []);
        
        if (success) {
            securityLogger.info('Account deleted by admin', {
                admin: req.session.username,
                deletedUser: username
            });
            
            res.json({
                success: true,
                message: 'Account erfolgreich gelöscht.'
            });
        } else {
            throw new Error('Failed to delete user');
        }
    } catch (error) {
        logger.error('Error deleting account:', { error: error.message, username: req.params.username });
        res.status(500).json({
            success: false,
            error: 'Fehler beim Löschen des Accounts.'
        });
    }
});

/**
 * GET /api/admin/roles
 * Get all roles (requires: manage_roles)
 */
router.get('/roles', requirePermission('manage_roles'), async (req, res) => {
    try {
        // TODO: Replace with MySQL query in future
        // SELECT * FROM roles ORDER BY name
        const rolesData = await readJsonFile(ROLES_FILE, { roles: [] });
        
        res.json({
            success: true,
            roles: rolesData.roles
        });
    } catch (error) {
        logger.error('Error listing roles:', { error: error.message });
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
        body('permissions').isArray()
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
            
            const { name, permissions } = req.body;
            
            // Generate unique role ID
            const roleId = `role-${crypto.randomBytes(8).toString('hex')}`;
            
            // Create role object
            const newRole = {
                id: roleId,
                name: name.trim(),
                permissions: permissions || [],
                createdAt: new Date().toISOString(),
                createdBy: req.session.username
            };
            
            // Add to roles file
            const success = await updateJsonFile(ROLES_FILE, (rolesData) => {
                if (!rolesData.roles) {
                    rolesData.roles = [];
                }
                rolesData.roles.push(newRole);
                return rolesData;
            }, { roles: [] });
            
            if (success) {
                securityLogger.info('Role created by admin', {
                    admin: req.session.username,
                    roleId,
                    roleName: name,
                    permissions
                });
                
                res.json({
                    success: true,
                    message: 'Rolle erfolgreich erstellt.',
                    role: newRole
                });
            } else {
                throw new Error('Failed to save role');
            }
        } catch (error) {
            logger.error('Error creating role:', { error: error.message });
            res.status(500).json({
                success: false,
                error: 'Fehler beim Erstellen der Rolle.'
            });
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
        body('permissions').optional().isArray()
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
            const { name, permissions } = req.body;
            
            // Update role
            const success = await updateJsonFile(ROLES_FILE, (rolesData) => {
                const roleIndex = rolesData.roles.findIndex(r => r.id === id);
                if (roleIndex !== -1) {
                    if (name !== undefined) rolesData.roles[roleIndex].name = name;
                    if (permissions !== undefined) rolesData.roles[roleIndex].permissions = permissions;
                    rolesData.roles[roleIndex].updatedAt = new Date().toISOString();
                    rolesData.roles[roleIndex].updatedBy = req.session.username;
                }
                return rolesData;
            }, { roles: [] });
            
            if (success) {
                securityLogger.info('Role updated by admin', {
                    admin: req.session.username,
                    roleId: id,
                    updates: { name, permissions }
                });
                
                res.json({
                    success: true,
                    message: 'Rolle erfolgreich aktualisiert.'
                });
            } else {
                throw new Error('Failed to update role');
            }
        } catch (error) {
            logger.error('Error updating role:', { error: error.message, roleId: req.params.id });
            res.status(500).json({
                success: false,
                error: 'Fehler beim Aktualisieren der Rolle.'
            });
        }
    }
);

/**
 * DELETE /api/admin/roles/:id
 * Delete role (requires: manage_roles)
 */
router.delete('/roles/:id', requirePermission('manage_roles'), async (req, res) => {
    try {
        const { id } = req.params;
        
        // Check if role is in use
        const users = await readJsonFile(USERS_FILE, []);
        const usersWithRole = users.filter(u => u.roles && u.roles.includes(id));
        
        if (usersWithRole.length > 0) {
            return res.status(400).json({
                success: false,
                error: `Diese Rolle wird noch von ${usersWithRole.length} Benutzer(n) verwendet und kann nicht gelöscht werden.`
            });
        }
        
        // Delete role
        const success = await updateJsonFile(ROLES_FILE, (rolesData) => {
            rolesData.roles = rolesData.roles.filter(r => r.id !== id);
            return rolesData;
        }, { roles: [] });
        
        if (success) {
            securityLogger.info('Role deleted by admin', {
                admin: req.session.username,
                roleId: id
            });
            
            res.json({
                success: true,
                message: 'Rolle erfolgreich gelöscht.'
            });
        } else {
            throw new Error('Failed to delete role');
        }
    } catch (error) {
        logger.error('Error deleting role:', { error: error.message, roleId: req.params.id });
        res.status(500).json({
            success: false,
            error: 'Fehler beim Löschen der Rolle.'
        });
    }
});

/**
 * GET /api/admin/registration-requests
 * List all registration requests (requires: handle_requests or manage_accounts)
 */
router.get('/registration-requests', requirePermission(['handle_requests', 'manage_accounts']), async (req, res) => {
    try {
        // TODO: Replace with MySQL query in future
        // SELECT * FROM registration_requests ORDER BY createdAt DESC
        const requestsData = await readJsonFile(REQUESTS_FILE, { requests: [] });
        
        // Remove password hashes from response
        const safeRequests = requestsData.requests.map(request => {
            const { passwordHash, ...safeRequest } = request;
            return safeRequest;
        });
        
        res.json({
            success: true,
            requests: safeRequests
        });
    } catch (error) {
        logger.error('Error listing registration requests:', { error: error.message });
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
        // TODO: Replace with MySQL query in future
        // SELECT COUNT(*) FROM registration_requests WHERE status = 'pending'
        const requestsData = await readJsonFile(REQUESTS_FILE, { requests: [] });
        const pendingCount = requestsData.requests.filter(r => r.status === 'pending').length;
        
        res.json({
            success: true,
            count: pendingCount
        });
    } catch (error) {
        logger.error('Error getting registration requests count:', { error: error.message });
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
    try {
        const { id } = req.params;
        
        // Find the request
        const requestsData = await readJsonFile(REQUESTS_FILE, { requests: [] });
        const request = requestsData.requests.find(r => r.id === id);
        
        if (!request) {
            return res.status(404).json({
                success: false,
                error: 'Registrierungsanfrage nicht gefunden.'
            });
        }
        
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
        
        // Create user account
        const newUser = {
            username: request.username,
            email: request.email,
            passwordHash: request.passwordHash,
            role: 'user',
            permissions: [],
            roles: [],
            createdAt: new Date().toISOString(),
            approvedBy: req.session.username
        };
        
        // Add to users file
        const userSuccess = await updateJsonFile(USERS_FILE, (users) => {
            users.push(newUser);
            return users;
        }, []);
        
        if (!userSuccess) {
            throw new Error('Failed to create user');
        }
        
        // Remove from requests (or mark as approved)
        const requestSuccess = await updateJsonFile(REQUESTS_FILE, (data) => {
            data.requests = data.requests.filter(r => r.id !== id);
            return data;
        }, { requests: [] });
        
        if (!requestSuccess) {
            logger.warn('User created but failed to remove registration request', { requestId: id });
        }
        
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
        logger.error('Error approving registration request:', { error: error.message, requestId: req.params.id });
        res.status(500).json({
            success: false,
            error: 'Fehler beim Genehmigen der Anfrage.'
        });
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
            
            // Update request status
            let found = false;
            const success = await updateJsonFile(REQUESTS_FILE, (data) => {
                const requestIndex = data.requests.findIndex(r => r.id === id);
                if (requestIndex !== -1) {
                    found = true;
                    data.requests[requestIndex].status = 'rejected';
                    data.requests[requestIndex].rejectedAt = new Date().toISOString();
                    data.requests[requestIndex].rejectedBy = req.session.username;
                    data.requests[requestIndex].rejectionReason = reason || null;
                }
                return data;
            }, { requests: [] });
            
            if (!found) {
                return res.status(404).json({
                    success: false,
                    error: 'Registrierungsanfrage nicht gefunden.'
                });
            }
            
            if (success) {
                securityLogger.info('Registration request rejected', {
                    admin: req.session.username,
                    requestId: id,
                    reason: reason || 'No reason provided'
                });
                
                res.json({
                    success: true,
                    message: 'Registrierungsanfrage erfolgreich abgelehnt.'
                });
            } else {
                throw new Error('Failed to reject request');
            }
            
        } catch (error) {
            logger.error('Error rejecting registration request:', { error: error.message, requestId: req.params.id });
            res.status(500).json({
                success: false,
                error: 'Fehler beim Ablehnen der Anfrage.'
            });
        }
    }
);

module.exports = router;
