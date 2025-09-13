const jwt = require('jsonwebtoken');
const db = require('../database/db');
const logger = require('../utils/logger');

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-this';

const authenticateToken = async (req, res, next) => {
  const authHeader = req.headers.authorization;
  const token = authHeader && authHeader.split(' ')[1];
  
  try {
    if (!token) {
      return res.status(401).json({
        success: false,
        error: 'Access token required'
      });
    }

    const decoded = jwt.verify(token, JWT_SECRET);
    
    const result = await db.query(
      'SELECT id, username, role, is_active, patient_id FROM users WHERE id = $1',
      [decoded.userId]
    );

    if (result.rows.length === 0 || !result.rows[0].is_active) {
      return res.status(401).json({
        success: false,
        error: 'Invalid or inactive user'
      });
    }

    req.user = {
      id: decoded.userId,
      username: decoded.username,
      role: decoded.role,
      patientId: result.rows[0].patient_id
    };

    next();
  } catch (error) {
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

  if (req.user.patientId) {
    req.patientFilter = req.user.patientId;
  } else {
    req.patientFilter = 'none';
  }
  
  next();
};

const buildPatientFilter = (req, patientIdColumn = 'patient_id', alias = '') => {
  if (!req.patientFilter) {
    return { whereClause: '', params: [] };
  }

  if (req.patientFilter === 'none') {
    return { 
      whereClause: ` AND ${alias ? alias + '.' : ''}${patientIdColumn} IS NULL`, 
      params: [] 
    };
  }

  return { 
    whereClause: ` AND ${alias ? alias + '.' : ''}${patientIdColumn} = $`, 
    params: [req.patientFilter] 
  };
};

module.exports = {
  authenticateToken,
  requireRole,
  requireAdmin,
  addPatientFilter,
  buildPatientFilter
};