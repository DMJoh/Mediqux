const express = require('express');
const router = express.Router();
const db = require('../database/db');

// Get all available institutions for dropdown (must be before /:id route)
router.get('/institutions/available', async (req, res) => {
  try {
    const result = await db.query(`
      SELECT id, name, type FROM institutions 
      ORDER BY name
    `);
    
    res.json({
      success: true,
      data: result.rows
    });
  } catch (error) {
    console.error('Error fetching institutions:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch institutions'
    });
  }
});

// Get all doctors with their institutions
router.get('/', async (req, res) => {
  try {
    const result = await db.query(`
      SELECT 
        d.id, 
        d.first_name, 
        d.last_name, 
        d.specialty, 
        d.license_number,
        d.phone, 
        d.email,
        d.created_at,
        ARRAY_AGG(
          CASE WHEN i.name IS NOT NULL 
          THEN json_build_object('id', i.id, 'name', i.name, 'type', i.type)
          ELSE NULL END
        ) FILTER (WHERE i.name IS NOT NULL) as institutions
      FROM doctors d
      LEFT JOIN doctor_institutions di ON d.id = di.doctor_id
      LEFT JOIN institutions i ON di.institution_id = i.id
      GROUP BY d.id, d.first_name, d.last_name, d.specialty, d.license_number, d.phone, d.email, d.created_at
      ORDER BY d.last_name, d.first_name
    `);
    
    res.json({
      success: true,
      data: result.rows,
      count: result.rows.length
    });
  } catch (error) {
    console.error('Error fetching doctors:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch doctors'
    });
  }
});

// Get single doctor by ID
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const result = await db.query(`
      SELECT 
        d.*,
        ARRAY_AGG(
          CASE WHEN i.name IS NOT NULL 
          THEN json_build_object('id', i.id, 'name', i.name, 'type', i.type)
          ELSE NULL END
        ) FILTER (WHERE i.name IS NOT NULL) as institutions
      FROM doctors d
      LEFT JOIN doctor_institutions di ON d.id = di.doctor_id
      LEFT JOIN institutions i ON di.institution_id = i.id
      WHERE d.id = $1
      GROUP BY d.id
    `, [id]);
    
    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Doctor not found'
      });
    }
    
    res.json({
      success: true,
      data: result.rows[0]
    });
  } catch (error) {
    console.error('Error fetching doctor:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch doctor'
    });
  }
});

// Create new doctor
router.post('/', async (req, res) => {
  const client = await db.getClient();
  
  try {
    await client.query('BEGIN');
    
    const {
      first_name,
      last_name,
      specialty,
      license_number,
      phone,
      email,
      institution_ids = []
    } = req.body;
    
    // Basic validation
    if (!first_name || !last_name) {
      return res.status(400).json({
        success: false,
        error: 'First name and last name are required'
      });
    }
    
    // Create doctor
    const doctorResult = await client.query(`
      INSERT INTO doctors (
        first_name, last_name, specialty, license_number, phone, email
      ) VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING *
    `, [first_name, last_name, specialty, license_number, phone, email]);
    
    const doctor = doctorResult.rows[0];
    
    // Link to institutions if provided
    if (institution_ids.length > 0) {
      for (const institutionId of institution_ids) {
        await client.query(`
          INSERT INTO doctor_institutions (doctor_id, institution_id)
          VALUES ($1, $2)
        `, [doctor.id, institutionId]);
      }
    }
    
    await client.query('COMMIT');
    
    res.status(201).json({
      success: true,
      data: doctor,
      message: 'Doctor created successfully'
    });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error creating doctor:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to create doctor'
    });
  } finally {
    client.release();
  }
});

// Update doctor
router.put('/:id', async (req, res) => {
  const client = await db.getClient();
  
  try {
    await client.query('BEGIN');
    
    const { id } = req.params;
    const {
      first_name,
      last_name,
      specialty,
      license_number,
      phone,
      email,
      institution_ids = []
    } = req.body;
    
    // Update doctor
    const doctorResult = await client.query(`
      UPDATE doctors SET
        first_name = $1,
        last_name = $2,
        specialty = $3,
        license_number = $4,
        phone = $5,
        email = $6,
        updated_at = CURRENT_TIMESTAMP
      WHERE id = $7
      RETURNING *
    `, [first_name, last_name, specialty, license_number, phone, email, id]);
    
    if (doctorResult.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({
        success: false,
        error: 'Doctor not found'
      });
    }
    
    // Update institution associations
    await client.query('DELETE FROM doctor_institutions WHERE doctor_id = $1', [id]);
    
    if (institution_ids.length > 0) {
      for (const institutionId of institution_ids) {
        await client.query(`
          INSERT INTO doctor_institutions (doctor_id, institution_id)
          VALUES ($1, $2)
        `, [id, institutionId]);
      }
    }
    
    await client.query('COMMIT');
    
    res.json({
      success: true,
      data: doctorResult.rows[0],
      message: 'Doctor updated successfully'
    });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error updating doctor:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to update doctor'
    });
  } finally {
    client.release();
  }
});

// Delete doctor
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    
    const result = await db.query(`
      DELETE FROM doctors WHERE id = $1 RETURNING id
    `, [id]);
    
    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Doctor not found'
      });
    }
    
    res.json({
      success: true,
      message: 'Doctor deleted successfully'
    });
  } catch (error) {
    console.error('Error deleting doctor:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to delete doctor'
    });
  }
});

module.exports = router;