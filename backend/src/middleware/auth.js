const jwt = require('jsonwebtoken');
const db = require('../database/db');
const logger = require('../utils/logger');

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-this';

const authenticateToken = async (req, res, next) => {
  const authHeader = req.headers.authorization;
  const token = authHeader && authHeader.split(' ')[1];
  
  try {
    const decoded = jwt.verify(token, JWT_SECRET);

    const result = await db.query(
      `SELECT u.id, u.username, u.role, u.is_active,
              COALESCE(ARRAY_AGG(upa.patient_id) FILTER (WHERE upa.patient_id IS NOT NULL), '{}') AS patient_ids
       FROM users u
       LEFT JOIN user_patient_access upa ON upa.user_id = u.id
       WHERE u.id = $1
       GROUP BY u.id`,
      [decoded.userId]
    );

    if (result.rows.length === 0 || !result.rows[0].is_active) {
      return res.status(401).json({
        success: false,
        error: 'Invalid or inactive user'
      });
    }

    req.user = {
      id: result.rows[0].id,
      username: result.rows[0].username,
      role: result.rows[0].role,
      patientIds: result.rows[0].patient_ids
    };

    next();
  } catch (error) {
    if (error.message === 'jwt must be provided') {
      return res.status(401).json({
        success: false,
        error: 'Access token required'
      });
    }
    logger.warn('Token verification failed', {
      error: error.message,
      token: token ? 'present' : 'missing'
    });
    return res.status(403).json({
      success: false,
      error: 'Invalid token'
    });
  }
};

const requireRole = (roles) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        error: 'Authentication required'
      });
    }

    if (!roles.includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        error: 'Insufficient permissions'
      });
    }

    next();
  };
};

const requireAdmin = requireRole(['admin']);

const addPatientFilter = (req, res, next) => {
  if (req.user.role === 'admin') {
    req.patientFilter = null;
    return next();
  }

  req.patientFilter = req.user.patientIds.length > 0 ? req.user.patientIds : 'none';

  next();
};

// Appends a patient-scoping condition to a manually-built query. `params` is the
// same array the caller is already pushing its own params onto — this pushes the
// patient id array (if any) and returns the SQL fragment to append, matching how
// every route in this codebase builds its WHERE clause incrementally.
const patientFilterClause = (patientFilter, column, params) => {
  if (patientFilter === null) return '1=1';
  if (patientFilter === 'none') return '1=0';
  params.push(patientFilter);
  return `${column} = ANY($${params.length}::uuid[])`;
};

// For single-row ownership checks (edit/delete/view one record) — true if the
// requester is allowed to touch a row belonging to `patientId`.
const patientFilterAllows = (patientFilter, patientId) => {
  if (patientFilter === null) return true;
  if (patientFilter === 'none') return false;
  return patientFilter.includes(patientId);
};

module.exports = {
  authenticateToken,
  requireRole,
  requireAdmin,
  addPatientFilter,
  patientFilterClause,
  patientFilterAllows
};