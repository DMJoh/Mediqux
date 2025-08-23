const express = require('express');
const router = express.Router();
const db = require('../database/db');

// Get upcoming appointments (for dashboard) - must be before /:id route
router.get('/dashboard/upcoming', async (req, res) => {
  try {
    const result = await db.query(`
      SELECT 
        a.id,
        a.appointment_date,
        a.type,
        a.status,
        p.first_name as patient_first_name,
        p.last_name as patient_last_name,
        d.first_name as doctor_first_name,
        d.last_name as doctor_last_name
      FROM appointments a
      LEFT JOIN patients p ON a.patient_id = p.id
      LEFT JOIN doctors d ON a.doctor_id = d.id
      WHERE a.appointment_date >= NOW() 
        AND a.status = 'scheduled'
      ORDER BY a.appointment_date ASC
      LIMIT 5
    `);
    
    res.json({
      success: true,
      data: result.rows
    });
  } catch (error) {
    console.error('Error fetching upcoming appointments:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch upcoming appointments'
    });
  }
});

// Get appointment statistics - must be before /:id route
router.get('/stats/summary', async (req, res) => {
  try {
    const result = await db.query(`
      SELECT 
        COUNT(*) as total_appointments,
        COUNT(CASE WHEN status = 'scheduled' AND appointment_date >= NOW() THEN 1 END) as upcoming,
        COUNT(CASE WHEN status = 'completed' THEN 1 END) as completed,
        COUNT(CASE WHEN status = 'cancelled' THEN 1 END) as cancelled,
        COUNT(CASE WHEN appointment_date::date = CURRENT_DATE THEN 1 END) as today
      FROM appointments
    `);
    
    res.json({
      success: true,
      data: result.rows[0]
    });
  } catch (error) {
    console.error('Error fetching appointment statistics:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch appointment statistics'
    });
  }
});

// Get all appointments with patient, doctor, and institution details
router.get('/', async (req, res) => {
  try {
    const { status, patient_id, doctor_id, date_from, date_to } = req.query;
    
    let query = `
      SELECT 
        a.id,
        a.appointment_date,
        a.type,
        a.status,
        a.notes,
        a.diagnosis,
        a.created_at,
        -- Patient details
        p.id as patient_id,
        p.first_name as patient_first_name,
        p.last_name as patient_last_name,
        p.phone as patient_phone,
        -- Doctor details
        d.id as doctor_id,
        d.first_name as doctor_first_name,
        d.last_name as doctor_last_name,
        d.specialty as doctor_specialty,
        -- Institution details
        i.id as institution_id,
        i.name as institution_name,
        i.type as institution_type
      FROM appointments a
      LEFT JOIN patients p ON a.patient_id = p.id
      LEFT JOIN doctors d ON a.doctor_id = d.id
      LEFT JOIN institutions i ON a.institution_id = i.id
      WHERE 1=1
    `;
    
    const queryParams = [];
    let paramIndex = 1;
    
    // Add filters if provided
    if (status) {
      query += ` AND a.status = $${paramIndex}`;
      queryParams.push(status);
      paramIndex++;
    }
    
    if (patient_id) {
      query += ` AND a.patient_id = $${paramIndex}`;
      queryParams.push(patient_id);
      paramIndex++;
    }
    
    if (doctor_id) {
      query += ` AND a.doctor_id = $${paramIndex}`;
      queryParams.push(doctor_id);
      paramIndex++;
    }
    
    if (date_from) {
      query += ` AND a.appointment_date >= $${paramIndex}`;
      queryParams.push(date_from);
      paramIndex++;
    }
    
    if (date_to) {
      query += ` AND a.appointment_date <= $${paramIndex}`;
      queryParams.push(date_to + ' 23:59:59');
      paramIndex++;
    }
    
    query += ' ORDER BY a.appointment_date DESC';
    
    const result = await db.query(query, queryParams);
    
    res.json({
      success: true,
      data: result.rows,
      count: result.rows.length
    });
  } catch (error) {
    console.error('Error fetching appointments:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch appointments'
    });
  }
});

// Get single appointment by ID
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    
    const result = await db.query(`
      SELECT 
        a.*,
        p.first_name as patient_first_name,
        p.last_name as patient_last_name,
        p.phone as patient_phone,
        p.email as patient_email,
        d.first_name as doctor_first_name,
        d.last_name as doctor_last_name,
        d.specialty as doctor_specialty,
        i.name as institution_name,
        i.type as institution_type
      FROM appointments a
      LEFT JOIN patients p ON a.patient_id = p.id
      LEFT JOIN doctors d ON a.doctor_id = d.id
      LEFT JOIN institutions i ON a.institution_id = i.id
      WHERE a.id = $1
    `, [id]);
    
    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Appointment not found'
      });
    }
    
    res.json({
      success: true,
      data: result.rows[0]
    });
  } catch (error) {
    console.error('Error fetching appointment:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch appointment'
    });
  }
});

// Create new appointment
router.post('/', async (req, res) => {
  try {
    const {
      patient_id,
      doctor_id,
      institution_id,
      appointment_date,
      type,
      status = 'scheduled',
      notes
    } = req.body;
    
    // Basic validation
    if (!patient_id || !appointment_date) {
      return res.status(400).json({
        success: false,
        error: 'Patient and appointment date are required'
      });
    }
    
    // Validate appointment date is not in the past (unless creating past appointment)
    const appointmentDateTime = new Date(appointment_date);
    const now = new Date();
    
    if (appointmentDateTime < now && status === 'scheduled') {
      return res.status(400).json({
        success: false,
        error: 'Cannot schedule appointment in the past'
      });
    }
    
    const result = await db.query(`
      INSERT INTO appointments (
        patient_id, doctor_id, institution_id, appointment_date, 
        type, status, notes
      ) VALUES ($1, $2, $3, $4, $5, $6, $7)
      RETURNING *
    `, [
      patient_id, 
      doctor_id || null, 
      institution_id || null, 
      appointment_date, 
      type || null, 
      status, 
      notes || null
    ]);
    
    res.status(201).json({
      success: true,
      data: result.rows[0],
      message: 'Appointment created successfully'
    });
  } catch (error) {
    console.error('Error creating appointment:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to create appointment'
    });
  }
});

// Update appointment
router.put('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const {
      patient_id,
      doctor_id,
      institution_id,
      appointment_date,
      type,
      status,
      notes,
      diagnosis
    } = req.body;
    
    const result = await db.query(`
      UPDATE appointments SET
        patient_id = $1,
        doctor_id = $2,
        institution_id = $3,
        appointment_date = $4,
        type = $5,
        status = $6,
        notes = $7,
        diagnosis = $8,
        updated_at = CURRENT_TIMESTAMP
      WHERE id = $9
      RETURNING *
    `, [
      patient_id,
      doctor_id || null,
      institution_id || null,
      appointment_date,
      type || null,
      status,
      notes || null,
      diagnosis || null,
      id
    ]);
    
    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Appointment not found'
      });
    }
    
    res.json({
      success: true,
      data: result.rows[0],
      message: 'Appointment updated successfully'
    });
  } catch (error) {
    console.error('Error updating appointment:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to update appointment'
    });
  }
});

// Delete appointment
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    
    const result = await db.query(`
      DELETE FROM appointments WHERE id = $1 RETURNING id, appointment_date
    `, [id]);
    
    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Appointment not found'
      });
    }
    
    res.json({
      success: true,
      message: 'Appointment deleted successfully'
    });
  } catch (error) {
    console.error('Error deleting appointment:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to delete appointment'
    });
  }
});

module.exports = router;