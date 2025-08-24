const express = require('express');
const router = express.Router();
const db = require('../database/db');

// Get all medications with usage statistics
router.get('/', async (req, res) => {
  try {
    const { search, dosage_form, manufacturer } = req.query;
    
    let query = `
      SELECT 
        m.id,
        m.name,
        m.generic_name,
        m.dosage_forms,
        m.strengths,
        m.manufacturer,
        m.description,
        m.created_at,
        COUNT(DISTINCT p.id) as prescription_count,
        COUNT(DISTINCT pm.id) as patient_medication_count
      FROM medications m
      LEFT JOIN prescriptions p ON m.id = p.medication_id
      LEFT JOIN patient_medications pm ON m.id = pm.medication_id
      WHERE 1=1
    `;
    
    const queryParams = [];
    let paramIndex = 1;
    
    // Add filters if provided
    if (search) {
      query += ` AND (m.name ILIKE $${paramIndex} OR m.generic_name ILIKE $${paramIndex} OR m.manufacturer ILIKE $${paramIndex})`;
      queryParams.push(`%${search}%`);
      paramIndex++;
    }
    
    if (dosage_form) {
      query += ` AND $${paramIndex} = ANY(m.dosage_forms)`;
      queryParams.push(dosage_form);
      paramIndex++;
    }
    
    if (manufacturer) {
      query += ` AND m.manufacturer ILIKE $${paramIndex}`;
      queryParams.push(`%${manufacturer}%`);
      paramIndex++;
    }
    
    query += ` 
      GROUP BY m.id, m.name, m.generic_name, m.dosage_forms, m.strengths, m.manufacturer, m.description, m.created_at
      ORDER BY m.name
    `;
    
    const result = await db.query(query, queryParams);
    
    res.json({
      success: true,
      data: result.rows,
      count: result.rows.length
    });
  } catch (error) {
    console.error('Error fetching medications:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch medications'
    });
  }
});

// Get single medication by ID
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    
    const result = await db.query(`
      SELECT 
        m.*,
        COUNT(DISTINCT p.id) as prescription_count,
        COUNT(DISTINCT pm.id) as patient_medication_count,
        ARRAY_AGG(
          CASE WHEN p.id IS NOT NULL 
          THEN json_build_object(
            'prescription_id', p.id,
            'appointment_id', p.appointment_id,
            'dosage', p.dosage,
            'frequency', p.frequency,
            'duration', p.duration
          )
          ELSE NULL END
        ) FILTER (WHERE p.id IS NOT NULL) as recent_prescriptions
      FROM medications m
      LEFT JOIN prescriptions p ON m.id = p.medication_id
      LEFT JOIN patient_medications pm ON m.id = pm.medication_id
      WHERE m.id = $1
      GROUP BY m.id
      LIMIT 1
    `, [id]);
    
    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Medication not found'
      });
    }
    
    res.json({
      success: true,
      data: result.rows[0]
    });
  } catch (error) {
    console.error('Error fetching medication:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch medication'
    });
  }
});

// Create new medication
router.post('/', async (req, res) => {
  try {
    const {
      name,
      generic_name,
      dosage_forms,
      strengths,
      manufacturer,
      description
    } = req.body;
    
    // Basic validation
    if (!name || !name.trim()) {
      return res.status(400).json({
        success: false,
        error: 'Medication name is required'
      });
    }
    
    // Check for duplicate medication names
    const existingMedication = await db.query(
      'SELECT id FROM medications WHERE LOWER(name) = LOWER($1)',
      [name.trim()]
    );
    
    if (existingMedication.rows.length > 0) {
      return res.status(400).json({
        success: false,
        error: 'A medication with this name already exists'
      });
    }
    
    // Process arrays
    const processedDosageForms = Array.isArray(dosage_forms) ? dosage_forms.filter(f => f.trim()) : [];
    const processedStrengths = Array.isArray(strengths) ? strengths.filter(s => s.trim()) : [];
    
    const result = await db.query(`
      INSERT INTO medications (
        name, generic_name, dosage_forms, strengths, manufacturer, description
      ) VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING *
    `, [
      name.trim(),
      generic_name?.trim() || null,
      processedDosageForms,
      processedStrengths,
      manufacturer?.trim() || null,
      description?.trim() || null
    ]);
    
    res.status(201).json({
      success: true,
      data: result.rows[0],
      message: 'Medication created successfully'
    });
  } catch (error) {
    console.error('Error creating medication:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to create medication'
    });
  }
});

// Update medication
router.put('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const {
      name,
      generic_name,
      dosage_forms,
      strengths,
      manufacturer,
      description
    } = req.body;
    
    // Basic validation
    if (!name || !name.trim()) {
      return res.status(400).json({
        success: false,
        error: 'Medication name is required'
      });
    }
    
    // Check for duplicate medication names (excluding current record)
    const existingMedication = await db.query(
      'SELECT id FROM medications WHERE LOWER(name) = LOWER($1) AND id != $2',
      [name.trim(), id]
    );
    
    if (existingMedication.rows.length > 0) {
      return res.status(400).json({
        success: false,
        error: 'A medication with this name already exists'
      });
    }
    
    // Process arrays
    const processedDosageForms = Array.isArray(dosage_forms) ? dosage_forms.filter(f => f.trim()) : [];
    const processedStrengths = Array.isArray(strengths) ? strengths.filter(s => s.trim()) : [];
    
    const result = await db.query(`
      UPDATE medications SET
        name = $1,
        generic_name = $2,
        dosage_forms = $3,
        strengths = $4,
        manufacturer = $5,
        description = $6,
        updated_at = CURRENT_TIMESTAMP
      WHERE id = $7
      RETURNING *
    `, [
      name.trim(),
      generic_name?.trim() || null,
      processedDosageForms,
      processedStrengths,
      manufacturer?.trim() || null,
      description?.trim() || null,
      id
    ]);
    
    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Medication not found'
      });
    }
    
    res.json({
      success: true,
      data: result.rows[0],
      message: 'Medication updated successfully'
    });
  } catch (error) {
    console.error('Error updating medication:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to update medication'
    });
  }
});

// Delete medication
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    
    // Check if medication is referenced in prescriptions or patient medications
    const usageCheck = await db.query(`
      SELECT 
        COUNT(DISTINCT p.id) as prescription_count,
        COUNT(DISTINCT pm.id) as patient_medication_count
      FROM medications m
      LEFT JOIN prescriptions p ON m.id = p.medication_id
      LEFT JOIN patient_medications pm ON m.id = pm.medication_id
      WHERE m.id = $1
      GROUP BY m.id
    `, [id]);
    
    if (usageCheck.rows.length > 0) {
      const prescriptionCount = parseInt(usageCheck.rows[0].prescription_count) || 0;
      const patientMedicationCount = parseInt(usageCheck.rows[0].patient_medication_count) || 0;
      const totalUsage = prescriptionCount + patientMedicationCount;
      
      if (totalUsage > 0) {
        return res.status(400).json({
          success: false,
          error: `Cannot delete medication. It is referenced in ${prescriptionCount} prescription(s) and ${patientMedicationCount} patient medication record(s). Please remove these references first.`
        });
      }
    }
    
    const result = await db.query(`
      DELETE FROM medications WHERE id = $1 RETURNING name
    `, [id]);
    
    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Medication not found'
      });
    }
    
    res.json({
      success: true,
      message: `Medication "${result.rows[0].name}" deleted successfully`
    });
  } catch (error) {
    console.error('Error deleting medication:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to delete medication'
    });
  }
});

// Get medication dosage forms for dropdown
router.get('/forms/available', async (req, res) => {
  try {
    const result = await db.query(`
      SELECT UNNEST(dosage_forms) as form, COUNT(*) as count
      FROM medications 
      WHERE dosage_forms IS NOT NULL AND array_length(dosage_forms, 1) > 0
      GROUP BY form
      ORDER BY count DESC, form
    `);
    
    // Add common dosage forms
    const commonForms = [
      'Tablet',
      'Capsule',
      'Syrup',
      'Suspension',
      'Injection',
      'Drops',
      'Cream',
      'Ointment',
      'Gel',
      'Patch',
      'Inhaler',
      'Spray',
      'Powder',
      'Granules',
      'Lotion',
      'Solution',
      'Other'
    ];
    
    const existingForms = result.rows.map(row => row.form);
    const allForms = [...new Set([...commonForms, ...existingForms])].sort();
    
    res.json({
      success: true,
      data: allForms
    });
  } catch (error) {
    console.error('Error fetching dosage forms:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch dosage forms'
    });
  }
});

// Get medication manufacturers for dropdown
router.get('/manufacturers/list', async (req, res) => {
  try {
    const result = await db.query(`
      SELECT DISTINCT manufacturer, COUNT(*) as count
      FROM medications 
      WHERE manufacturer IS NOT NULL AND manufacturer != ''
      GROUP BY manufacturer
      ORDER BY count DESC, manufacturer
    `);
    
    res.json({
      success: true,
      data: result.rows
    });
  } catch (error) {
    console.error('Error fetching manufacturers:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch manufacturers'
    });
  }
});

// Get medication statistics
router.get('/stats/summary', async (req, res) => {
  try {
    const result = await db.query(`
      SELECT 
        COUNT(*) as total_medications,
        COUNT(DISTINCT manufacturer) as total_manufacturers,
        COUNT(CASE WHEN generic_name IS NOT NULL AND generic_name != '' THEN 1 END) as with_generic_names,
        COUNT(CASE WHEN array_length(dosage_forms, 1) > 1 THEN 1 END) as multiple_forms,
        COUNT(CASE WHEN array_length(strengths, 1) > 1 THEN 1 END) as multiple_strengths
      FROM medications
    `);
    
    res.json({
      success: true,
      data: result.rows[0]
    });
  } catch (error) {
    console.error('Error fetching medication statistics:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch medication statistics'
    });
  }
});

module.exports = router;