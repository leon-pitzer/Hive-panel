/**
 * Absences Management Routes
 * Handles absence/vacation management for users
 */

const express = require('express');
const { body, validationResult } = require('express-validator');
const rateLimit = require('express-rate-limit');
const csurf = require('csurf');
const { getPool } = require('../html/utils/database');
const { logger, securityLogger } = require('../html/utils/logger');
const { requirePermission } = require('../middleware/permissionCheck');

const router = express.Router();

// CSRF protection
const csrfProtection = csurf({ cookie: true });

// Rate limiting for absence operations
const absenceLimit = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 30, // 30 requests per window
    message: { success: false, error: 'Zu viele Anfragen. Bitte versuchen Sie es später erneut.' },
    standardHeaders: true,
    legacyHeaders: false,
});

/**
 * Middleware: Ensure user is authenticated
 */
function requireAuth(req, res, next) {
    if (!req.session || !req.session.userId) {
        return res.status(401).json({
            success: false,
            error: 'Nicht authentifiziert'
        });
    }
    next();
}

/**
 * Helper: Get user ID from username
 */
async function getUserIdFromUsername(username) {
    const pool = getPool();
    const [rows] = await pool.query(
        'SELECT id FROM users WHERE username = ?',
        [username]
    );
    return rows.length > 0 ? rows[0].id : null;
}

/**
 * Helper: Validate absence dates
 * Returns { valid: boolean, error?: string }
 */
function validateAbsenceDates(startDate, endDate) {
    const start = new Date(startDate);
    const end = new Date(endDate);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    // Check if dates are valid
    if (isNaN(start.getTime()) || isNaN(end.getTime())) {
        return { valid: false, error: 'Ungültige Datumswerte' };
    }
    
    // Check if start date is at least 3 days in the future
    const threeDaysFromNow = new Date(today);
    threeDaysFromNow.setDate(threeDaysFromNow.getDate() + 3);
    
    if (start < threeDaysFromNow) {
        return { valid: false, error: 'Abwesenheit muss mindestens 3 Tage im Voraus angemeldet werden' };
    }
    
    // Check if end date is after start date
    if (end < start) {
        return { valid: false, error: 'Enddatum muss nach dem Startdatum liegen' };
    }
    
    // Check if duration is at least 3 days
    const durationInDays = Math.ceil((end - start) / (1000 * 60 * 60 * 24));
    if (durationInDays < 3) {
        return { valid: false, error: 'Abwesenheit muss mindestens 3 Tage dauern' };
    }
    
    return { valid: true };
}

/**
 * GET /api/absences
 * Get all absences (requires view_absences permission)
 */
router.get('/', requireAuth, requirePermission(['view_absences']), absenceLimit, async (req, res) => {
    try {
        const pool = getPool();
        const [absences] = await pool.query(`
            SELECT a.*, u.username, u.display_name
            FROM absences a
            JOIN users u ON a.user_id = u.id
            ORDER BY a.start_date DESC
        `);
        
        res.json({
            success: true,
            absences: absences
        });
    } catch (error) {
        logger.error('Error fetching absences:', { error: error.message });
        res.status(500).json({
            success: false,
            error: 'Fehler beim Laden der Abwesenheiten'
        });
    }
});

/**
 * GET /api/absences/my
 * Get own absences (authenticated users only)
 */
router.get('/my', requireAuth, absenceLimit, async (req, res) => {
    try {
        const username = req.session.userId;
        const userId = await getUserIdFromUsername(username);
        
        if (!userId) {
            return res.status(404).json({
                success: false,
                error: 'Benutzer nicht gefunden'
            });
        }
        
        const pool = getPool();
        const [absences] = await pool.query(`
            SELECT * FROM absences
            WHERE user_id = ?
            ORDER BY start_date DESC
        `, [userId]);
        
        res.json({
            success: true,
            absences: absences
        });
    } catch (error) {
        logger.error('Error fetching user absences:', { error: error.message });
        res.status(500).json({
            success: false,
            error: 'Fehler beim Laden der eigenen Abwesenheiten'
        });
    }
});

/**
 * POST /api/absences
 * Create new absence (authenticated users)
 */
router.post('/',
    requireAuth,
    absenceLimit,
    csrfProtection,
    [
        body('startDate')
            .notEmpty()
            .withMessage('Startdatum ist erforderlich')
            .isDate()
            .withMessage('Ungültiges Startdatum'),
        body('endDate')
            .notEmpty()
            .withMessage('Enddatum ist erforderlich')
            .isDate()
            .withMessage('Ungültiges Enddatum'),
        body('startTime')
            .optional({ nullable: true })
            .matches(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/)
            .withMessage('Ungültige Startzeit (Format: HH:MM)'),
        body('endTime')
            .optional({ nullable: true })
            .matches(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/)
            .withMessage('Ungültige Endzeit (Format: HH:MM)'),
        body('reason')
            .trim()
            .notEmpty()
            .withMessage('Grund ist erforderlich')
            .isLength({ min: 5, max: 1000 })
            .withMessage('Grund muss zwischen 5 und 1000 Zeichen lang sein')
    ],
    async (req, res) => {
        try {
            // Validate input
            const errors = validationResult(req);
            if (!errors.isEmpty()) {
                return res.status(400).json({
                    success: false,
                    error: errors.array()[0].msg
                });
            }
            
            const { startDate, endDate, startTime, endTime, reason } = req.body;
            const username = req.session.userId;
            
            // Validate dates
            const dateValidation = validateAbsenceDates(startDate, endDate);
            if (!dateValidation.valid) {
                return res.status(400).json({
                    success: false,
                    error: dateValidation.error
                });
            }
            
            // Get user ID
            const userId = await getUserIdFromUsername(username);
            if (!userId) {
                return res.status(404).json({
                    success: false,
                    error: 'Benutzer nicht gefunden'
                });
            }
            
            // Create absence
            const pool = getPool();
            const [result] = await pool.query(`
                INSERT INTO absences (user_id, start_date, end_date, start_time, end_time, reason)
                VALUES (?, ?, ?, ?, ?, ?)
            `, [userId, startDate, endDate, startTime || null, endTime || null, reason]);
            
            logger.info('Absence created', {
                username: username,
                absenceId: result.insertId,
                startDate: startDate,
                endDate: endDate
            });
            
            res.json({
                success: true,
                message: 'Abwesenheit erfolgreich erstellt',
                absenceId: result.insertId
            });
        } catch (error) {
            logger.error('Error creating absence:', { error: error.message });
            res.status(500).json({
                success: false,
                error: 'Fehler beim Erstellen der Abwesenheit'
            });
        }
    }
);

/**
 * DELETE /api/absences/:id
 * Delete own absence (authenticated users)
 */
router.delete('/:id', requireAuth, absenceLimit, csrfProtection, async (req, res) => {
    try {
        const absenceId = parseInt(req.params.id, 10);
        const username = req.session.userId;
        
        if (isNaN(absenceId)) {
            return res.status(400).json({
                success: false,
                error: 'Ungültige Abwesenheits-ID'
            });
        }
        
        // Get user ID
        const userId = await getUserIdFromUsername(username);
        if (!userId) {
            return res.status(404).json({
                success: false,
                error: 'Benutzer nicht gefunden'
            });
        }
        
        // Check if absence belongs to user
        const pool = getPool();
        const [absences] = await pool.query(
            'SELECT * FROM absences WHERE id = ? AND user_id = ?',
            [absenceId, userId]
        );
        
        if (absences.length === 0) {
            return res.status(404).json({
                success: false,
                error: 'Abwesenheit nicht gefunden oder keine Berechtigung'
            });
        }
        
        // Delete absence
        await pool.query('DELETE FROM absences WHERE id = ?', [absenceId]);
        
        logger.info('Absence deleted by owner', {
            username: username,
            absenceId: absenceId
        });
        
        res.json({
            success: true,
            message: 'Abwesenheit erfolgreich gelöscht'
        });
    } catch (error) {
        logger.error('Error deleting absence:', { error: error.message });
        res.status(500).json({
            success: false,
            error: 'Fehler beim Löschen der Abwesenheit'
        });
    }
});

/**
 * DELETE /api/absences/:id/admin
 * Delete any absence (requires manage_absences permission)
 */
router.delete('/:id/admin',
    requireAuth,
    requirePermission(['manage_absences']),
    absenceLimit,
    csrfProtection,
    async (req, res) => {
        try {
            const absenceId = parseInt(req.params.id, 10);
            const username = req.session.userId;
            
            if (isNaN(absenceId)) {
                return res.status(400).json({
                    success: false,
                    error: 'Ungültige Abwesenheits-ID'
                });
            }
            
            // Check if absence exists
            const pool = getPool();
            const [absences] = await pool.query(
                'SELECT * FROM absences WHERE id = ?',
                [absenceId]
            );
            
            if (absences.length === 0) {
                return res.status(404).json({
                    success: false,
                    error: 'Abwesenheit nicht gefunden'
                });
            }
            
            // Delete absence
            await pool.query('DELETE FROM absences WHERE id = ?', [absenceId]);
            
            securityLogger.info('Absence deleted by admin', {
                username: username,
                absenceId: absenceId,
                targetUserId: absences[0].user_id
            });
            
            res.json({
                success: true,
                message: 'Abwesenheit erfolgreich gelöscht'
            });
        } catch (error) {
            logger.error('Error deleting absence (admin):', { error: error.message });
            res.status(500).json({
                success: false,
                error: 'Fehler beim Löschen der Abwesenheit'
            });
        }
    }
);

module.exports = router;
