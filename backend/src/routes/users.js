const express = require('express');
const bcrypt = require('bcrypt');
const router = express.Router();
const db = require('../database/db');
const { requireAdmin } = require('../middleware/auth');

// Get all users (admin only)
router.get('/', requireAdmin, async (req, res) => {
  try {
    const result = await db.query(`
      SELECT u.id, u.username, u.email, u.first_name, u.last_name, u.role, 
             u.patient_id, u.is_active, u.last_login, u.created_at,
             p.first_name as patient_first_name, p.last_name as patient_last_name
      FROM users u
      LEFT JOIN patients p ON u.patient_id = p.id
      ORDER BY u.created_at DESC
    `);

    res.json({
      success: true,
      data: result.rows,
      count: result.rows.length
    });
  } catch (error) {
    console.error('Error fetching users:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch users'
    });
  }
});

// Create new user (admin only)
router.post('/', requireAdmin, async (req, res) => {
  try {
    const { username, email, password, firstName, lastName, role, patientId } = req.body;

    // Validation
    if (!username || !email || !password || !firstName || !lastName) {
      return res.status(400).json({
        success: false,
        error: 'Username, email, password, first name, and last name are required'
      });
    }

    // Check if user already exists
    const existingUser = await db.query(
      'SELECT id FROM users WHERE username = $1 OR email = $2',
      [username, email]
    );

    if (existingUser.rows.length > 0) {
      return res.status(400).json({
        success: false,
        error: 'User already exists with this username or email'
      });
    }

    // Validate patient exists if patientId provided
    if (patientId) {
      const patientCheck = await db.query('SELECT id FROM patients WHERE id = $1', [patientId]);
      if (patientCheck.rows.length === 0) {
        return res.status(400).json({
          success: false,
          error: 'Selected patient not found'
        });
      }
    }

    // Hash password
    const saltRounds = 10;
    const passwordHash = await bcrypt.hash(password, saltRounds);

    // Create user
    const result = await db.query(
      `INSERT INTO users (username, email, password_hash, first_name, last_name, role, patient_id) 
       VALUES ($1, $2, $3, $4, $5, $6, $7) 
       RETURNING id, username, email, first_name, last_name, role, patient_id, created_at`,
      [username, email, passwordHash, firstName, lastName, role || 'user', patientId || null]
    );

    const user = result.rows[0];

    res.status(201).json({
      success: true,
      message: 'User created successfully',
      data: {
        id: user.id,
        username: user.username,
        email: user.email,
        firstName: user.first_name,
        lastName: user.last_name,
        role: user.role,
        patientId: user.patient_id,
        createdAt: user.created_at
      }
    });
  } catch (error) {
    console.error('Create user error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to create user'
    });
  }
});

// Update user (admin only)
router.put('/:id', requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const { username, email, firstName, lastName, role, patientId, isActive } = req.body;

    // Check if user exists
    const userCheck = await db.query('SELECT id FROM users WHERE id = $1', [id]);
    if (userCheck.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'User not found'
      });
    }

    // Validate patient exists if patientId provided
    if (patientId) {
      const patientCheck = await db.query('SELECT id FROM patients WHERE id = $1', [patientId]);
      if (patientCheck.rows.length === 0) {
        return res.status(400).json({
          success: false,
          error: 'Selected patient not found'
        });
      }
    }

    // Update user
    const result = await db.query(
      `UPDATE users 
       SET username = $1, email = $2, first_name = $3, last_name = $4, 
           role = $5, patient_id = $6, is_active = $7, updated_at = CURRENT_TIMESTAMP
       WHERE id = $8
       RETURNING id, username, email, first_name, last_name, role, patient_id, is_active`,
      [username, email, firstName, lastName, role, patientId || null, isActive, id]
    );

    res.json({
      success: true,
      message: 'User updated successfully',
      data: result.rows[0]
    });
  } catch (error) {
    console.error('Update user error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to update user'
    });
  }
});

// Delete user (admin only)
router.delete('/:id', requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;

    // Check if user exists
    const userCheck = await db.query('SELECT id, role FROM users WHERE id = $1', [id]);
    if (userCheck.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'User not found'
      });
    }

    // Prevent deleting the last admin
    if (userCheck.rows[0].role === 'admin') {
      const adminCount = await db.query('SELECT COUNT(*) as count FROM users WHERE role = $1', ['admin']);
      if (parseInt(adminCount.rows[0].count) <= 1) {
        return res.status(400).json({
          success: false,
          error: 'Cannot delete the last admin user'
        });
      }
    }

    // Delete user
    await db.query('DELETE FROM users WHERE id = $1', [id]);

    res.json({
      success: true,
      message: 'User deleted successfully'
    });
  } catch (error) {
    console.error('Delete user error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to delete user'
    });
  }
});

// Reset user password (admin only)
router.put('/:id/reset-password', requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const { newPassword } = req.body;

    if (!newPassword || newPassword.length < 6) {
      return res.status(400).json({
        success: false,
        error: 'Password must be at least 6 characters long'
      });
    }

    // Check if user exists
    const userCheck = await db.query('SELECT id FROM users WHERE id = $1', [id]);
    if (userCheck.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'User not found'
      });
    }

    // Hash new password
    const saltRounds = 10;
    const passwordHash = await bcrypt.hash(newPassword, saltRounds);

    // Update password
    await db.query(
      'UPDATE users SET password_hash = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2',
      [passwordHash, id]
    );

    res.json({
      success: true,
      message: 'Password reset successfully'
    });
  } catch (error) {
    console.error('Reset password error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to reset password'
    });
  }
});

module.exports = router;