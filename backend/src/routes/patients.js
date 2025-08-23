const express = require('express');
const router = express.Router();
const db = require('../database/db');

// Get all patients
router.get('/', async (req, res) => {
  try {
    const result = await db.query(`
      SELECT 
        id, 
        first_name, 
        last_name, 
        date_of_birth, 
        gender, 
        phone, 
        email,
        created_at
      FROM patients 
      ORDER BY last_name, first_name
    `);
    
    res.json({
      success: true,
      data: result.rows,
      count: result.rows.length
    });
  } catch (error) {
    console.error('Error fetching patients:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch patients'
    });
  }
});

// Get single patient by ID
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const result = await db.query(`
      SELECT * FROM patients WHERE id = $1
    `, [id]);
    
    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Patient not found'
      });
    }
    
    res.json({
      success: true,
      data: result.rows[0]
    });
  } catch (error) {
    console.error('Error fetching patient:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch patient'
    });
  }
});

// Create new patient
router.post('/', async (req, res) => {
  try {
    const {
      first_name,
      last_name,
      date_of_birth,
      gender,
      phone,
      email,
      address,
      emergency_contact_name,
      emergency_contact_phone
    } = req.body;
    
    // Basic validation
    if (!first_name || !last_name) {
      return res.status(400).json({
        success: false,
        error: 'First name and last name are required'
      });
    }
    
    const result = await db.query(`
      INSERT INTO patients (
        first_name, last_name, date_of_birth, gender, 
        phone, email, address, emergency_contact_name, emergency_contact_phone
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      RETURNING *
    `, [
      first_name, last_name, date_of_birth, gender,
      phone, email, address, emergency_contact_name, emergency_contact_phone
    ]);
    
    res.status(201).json({
      success: true,
      data: result.rows[0],
      message: 'Patient created successfully'
    });
  } catch (error) {
    console.error('Error creating patient:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to create patient'
    });
  }
});

// Update patient
router.put('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const {
      first_name,
      last_name,
      date_of_birth,
      gender,
      phone,
      email,
      address,
      emergency_contact_name,
      emergency_contact_phone
    } = req.body;
    
    const result = await db.query(`
      UPDATE patients SET
        first_name = $1,
        last_name = $2,
        date_of_birth = $3,
        gender = $4,
        phone = $5,
        email = $6,
        address = $7,
        emergency_contact_name = $8,
        emergency_contact_phone = $9,
        updated_at = CURRENT_TIMESTAMP
      WHERE id = $10
      RETURNING *
    `, [
      first_name, last_name, date_of_birth, gender,
      phone, email, address, emergency_contact_name, emergency_contact_phone, id
    ]);
    
    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Patient not found'
      });
    }
    
    res.json({
      success: true,
      data: result.rows[0],
      message: 'Patient updated successfully'
    });
  } catch (error) {
    console.error('Error updating patient:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to update patient'
    });
  }
});

// Delete patient
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    
    const result = await db.query(`
      DELETE FROM patients WHERE id = $1 RETURNING id
    `, [id]);
    
    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Patient not found'
      });
    }
    
    res.json({
      success: true,
      message: 'Patient deleted successfully'
    });
  } catch (error) {
    console.error('Error deleting patient:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to delete patient'
    });
  }
});

module.exports = router;