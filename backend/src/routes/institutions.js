const express = require('express');
const router = express.Router();
const db = require('../database/db');

// Get all institutions with associated doctors count
router.get('/', async (req, res) => {
  try {
    const result = await db.query(`
      SELECT 
        i.id, 
        i.name, 
        i.type, 
        i.address,
        i.phone, 
        i.email,
        i.website,
        i.created_at,
        COUNT(di.doctor_id) as doctor_count
      FROM institutions i
      LEFT JOIN doctor_institutions di ON i.id = di.institution_id
      GROUP BY i.id, i.name, i.type, i.address, i.phone, i.email, i.website, i.created_at
      ORDER BY i.name
    `);
    
    res.json({
      success: true,
      data: result.rows,
      count: result.rows.length
    });
  } catch (error) {
    console.error('Error fetching institutions:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch institutions'
    });
  }
});

// Get single institution by ID with associated doctors
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    
    // Get institution details
    const institutionResult = await db.query(`
      SELECT * FROM institutions WHERE id = $1
    `, [id]);
    
    if (institutionResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Institution not found'
      });
    }
    
    // Get associated doctors
    const doctorsResult = await db.query(`
      SELECT 
        d.id, d.first_name, d.last_name, d.specialty
      FROM doctors d
      JOIN doctor_institutions di ON d.id = di.doctor_id
      WHERE di.institution_id = $1
      ORDER BY d.last_name, d.first_name
    `, [id]);
    
    const institution = institutionResult.rows[0];
    institution.doctors = doctorsResult.rows;
    
    res.json({
      success: true,
      data: institution
    });
  } catch (error) {
    console.error('Error fetching institution:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch institution'
    });
  }
});

// Create new institution
router.post('/', async (req, res) => {
  try {
    const {
      name,
      type,
      address,
      phone,
      email,
      website
    } = req.body;
    
    // Basic validation
    if (!name || !name.trim()) {
      return res.status(400).json({
        success: false,
        error: 'Institution name is required'
      });
    }
    
    const result = await db.query(`
      INSERT INTO institutions (
        name, type, address, phone, email, website
      ) VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING *
    `, [
      name.trim(), 
      type?.trim() || null, 
      address?.trim() || null, 
      phone?.trim() || null, 
      email?.trim() || null, 
      website?.trim() || null
    ]);
    
    res.status(201).json({
      success: true,
      data: result.rows[0],
      message: 'Institution created successfully'
    });
  } catch (error) {
    console.error('Error creating institution:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to create institution'
    });
  }
});

// Update institution
router.put('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const {
      name,
      type,
      address,
      phone,
      email,
      website
    } = req.body;
    
    // Basic validation
    if (!name || !name.trim()) {
      return res.status(400).json({
        success: false,
        error: 'Institution name is required'
      });
    }
    
    const result = await db.query(`
      UPDATE institutions SET
        name = $1,
        type = $2,
        address = $3,
        phone = $4,
        email = $5,
        website = $6,
        updated_at = CURRENT_TIMESTAMP
      WHERE id = $7
      RETURNING *
    `, [
      name.trim(), 
      type?.trim() || null, 
      address?.trim() || null, 
      phone?.trim() || null, 
      email?.trim() || null, 
      website?.trim() || null, 
      id
    ]);
    
    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Institution not found'
      });
    }
    
    res.json({
      success: true,
      data: result.rows[0],
      message: 'Institution updated successfully'
    });
  } catch (error) {
    console.error('Error updating institution:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to update institution'
    });
  }
});

// Delete institution
router.delete('/:id', async (req, res) => {
  const client = await db.getClient();
  
  try {
    await client.query('BEGIN');
    
    const { id } = req.params;
    
    // Check if institution has associated doctors
    const associationsResult = await client.query(`
      SELECT COUNT(*) as count FROM doctor_institutions WHERE institution_id = $1
    `, [id]);
    
    const associationsCount = parseInt(associationsResult.rows[0].count);
    
    if (associationsCount > 0) {
      await client.query('ROLLBACK');
      return res.status(400).json({
        success: false,
        error: `Cannot delete institution. It has ${associationsCount} associated doctor(s). Please remove doctor associations first.`
      });
    }
    
    // Delete institution
    const result = await client.query(`
      DELETE FROM institutions WHERE id = $1 RETURNING id, name
    `, [id]);
    
    if (result.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({
        success: false,
        error: 'Institution not found'
      });
    }
    
    await client.query('COMMIT');
    
    res.json({
      success: true,
      message: `Institution "${result.rows[0].name}" deleted successfully`
    });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error deleting institution:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to delete institution'
    });
  } finally {
    client.release();
  }
});

// Get institution types for dropdown
router.get('/types/available', async (req, res) => {
  try {
    const result = await db.query(`
      SELECT DISTINCT type FROM institutions 
      WHERE type IS NOT NULL AND type != ''
      ORDER BY type
    `);
    
    // Add common institution types
    const commonTypes = ['Hospital', 'Clinic', 'Laboratory', 'Pharmacy', 'Diagnostic Center', 'Nursing Home'];
    const existingTypes = result.rows.map(row => row.type);
    const allTypes = [...new Set([...commonTypes, ...existingTypes])].sort();
    
    res.json({
      success: true,
      data: allTypes
    });
  } catch (error) {
    console.error('Error fetching institution types:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch institution types'
    });
  }
});

module.exports = router;