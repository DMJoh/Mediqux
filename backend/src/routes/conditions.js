const express = require('express');
const router = express.Router();
const db = require('../database/db');

// Get all medical conditions with usage statistics
router.get('/', async (req, res) => {
  try {
    const { category, search } = req.query;
    
    let query = `
      SELECT 
        mc.id,
        mc.name,
        mc.description,
        mc.icd_code,
        mc.category,
        mc.severity,
        mc.created_at,
        COUNT(DISTINCT a.id) as usage_count
      FROM medical_conditions mc
      LEFT JOIN appointments a ON mc.name ILIKE '%' || a.diagnosis || '%' OR a.diagnosis ILIKE '%' || mc.name || '%'
      WHERE 1=1
    `;
    
    const queryParams = [];
    let paramIndex = 1;
    
    // Add filters if provided
    if (category) {
      query += ` AND mc.category = $${paramIndex}`;
      queryParams.push(category);
      paramIndex++;
    }
    
    if (search) {
      query += ` AND (mc.name ILIKE $${paramIndex} OR mc.description ILIKE $${paramIndex} OR mc.icd_code ILIKE $${paramIndex})`;
      queryParams.push(`%${search}%`);
      paramIndex++;
    }
    
    query += ` 
      GROUP BY mc.id, mc.name, mc.description, mc.icd_code, mc.category, mc.severity, mc.created_at
      ORDER BY mc.name
    `;
    
    const result = await db.query(query, queryParams);
    
    res.json({
      success: true,
      data: result.rows,
      count: result.rows.length
    });
  } catch (error) {
    console.error('Error fetching medical conditions:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch medical conditions'
    });
  }
});

// Get single medical condition by ID
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    
    const result = await db.query(`
      SELECT 
        mc.*,
        COUNT(DISTINCT a.id) as usage_count,
        ARRAY_AGG(
          CASE WHEN a.id IS NOT NULL 
          THEN json_build_object(
            'appointment_id', a.id,
            'patient_name', p.first_name || ' ' || p.last_name,
            'appointment_date', a.appointment_date,
            'diagnosis', a.diagnosis
          )
          ELSE NULL END
        ) FILTER (WHERE a.id IS NOT NULL) as recent_appointments
      FROM medical_conditions mc
      LEFT JOIN appointments a ON mc.name ILIKE '%' || a.diagnosis || '%' OR a.diagnosis ILIKE '%' || mc.name || '%'
      LEFT JOIN patients p ON a.patient_id = p.id
      WHERE mc.id = $1
      GROUP BY mc.id
      LIMIT 1
    `, [id]);
    
    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Medical condition not found'
      });
    }
    
    res.json({
      success: true,
      data: result.rows[0]
    });
  } catch (error) {
    console.error('Error fetching medical condition:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch medical condition'
    });
  }
});

// Create new medical condition
router.post('/', async (req, res) => {
  try {
    const {
      name,
      description,
      icd_code,
      category,
      severity
    } = req.body;
    
    // Basic validation
    if (!name || !name.trim()) {
      return res.status(400).json({
        success: false,
        error: 'Condition name is required'
      });
    }
    
    // Check for duplicate condition names
    const existingCondition = await db.query(
      'SELECT id FROM medical_conditions WHERE LOWER(name) = LOWER($1)',
      [name.trim()]
    );
    
    if (existingCondition.rows.length > 0) {
      return res.status(400).json({
        success: false,
        error: 'A condition with this name already exists'
      });
    }
    
    // Check for duplicate ICD codes if provided
    if (icd_code && icd_code.trim()) {
      const existingICD = await db.query(
        'SELECT id FROM medical_conditions WHERE LOWER(icd_code) = LOWER($1)',
        [icd_code.trim()]
      );
      
      if (existingICD.rows.length > 0) {
        return res.status(400).json({
          success: false,
          error: 'A condition with this ICD code already exists'
        });
      }
    }
    
    const result = await db.query(`
      INSERT INTO medical_conditions (
        name, description, icd_code, category, severity
      ) VALUES ($1, $2, $3, $4, $5)
      RETURNING *
    `, [
      name.trim(),
      description?.trim() || null,
      icd_code?.trim() || null,
      category?.trim() || null,
      severity?.trim() || null
    ]);
    
    res.status(201).json({
      success: true,
      data: result.rows[0],
      message: 'Medical condition created successfully'
    });
  } catch (error) {
    console.error('Error creating medical condition:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to create medical condition'
    });
  }
});

// Update medical condition
router.put('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const {
      name,
      description,
      icd_code,
      category,
      severity
    } = req.body;
    
    // Basic validation
    if (!name || !name.trim()) {
      return res.status(400).json({
        success: false,
        error: 'Condition name is required'
      });
    }
    
    // Check for duplicate condition names (excluding current record)
    const existingCondition = await db.query(
      'SELECT id FROM medical_conditions WHERE LOWER(name) = LOWER($1) AND id != $2',
      [name.trim(), id]
    );
    
    if (existingCondition.rows.length > 0) {
      return res.status(400).json({
        success: false,
        error: 'A condition with this name already exists'
      });
    }
    
    // Check for duplicate ICD codes if provided (excluding current record)
    if (icd_code && icd_code.trim()) {
      const existingICD = await db.query(
        'SELECT id FROM medical_conditions WHERE LOWER(icd_code) = LOWER($1) AND id != $2',
        [icd_code.trim(), id]
      );
      
      if (existingICD.rows.length > 0) {
        return res.status(400).json({
          success: false,
          error: 'A condition with this ICD code already exists'
        });
      }
    }
    
    const result = await db.query(`
      UPDATE medical_conditions SET
        name = $1,
        description = $2,
        icd_code = $3,
        category = $4,
        severity = $5,
        updated_at = CURRENT_TIMESTAMP
      WHERE id = $6
      RETURNING *
    `, [
      name.trim(),
      description?.trim() || null,
      icd_code?.trim() || null,
      category?.trim() || null,
      severity?.trim() || null,
      id
    ]);
    
    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Medical condition not found'
      });
    }
    
    res.json({
      success: true,
      data: result.rows[0],
      message: 'Medical condition updated successfully'
    });
  } catch (error) {
    console.error('Error updating medical condition:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to update medical condition'
    });
  }
});

// Delete medical condition
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    
    // Check if condition is referenced in appointments
    const appointmentCheck = await db.query(`
      SELECT COUNT(*) as count 
      FROM appointments a
      JOIN medical_conditions mc ON (a.diagnosis ILIKE '%' || mc.name || '%')
      WHERE mc.id = $1
    `, [id]);
    
    const usageCount = parseInt(appointmentCheck.rows[0].count);
    
    if (usageCount > 0) {
      return res.status(400).json({
        success: false,
        error: `Cannot delete condition. It is referenced in ${usageCount} appointment(s). Please update those appointments first.`
      });
    }
    
    const result = await db.query(`
      DELETE FROM medical_conditions WHERE id = $1 RETURNING name
    `, [id]);
    
    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Medical condition not found'
      });
    }
    
    res.json({
      success: true,
      message: `Medical condition "${result.rows[0].name}" deleted successfully`
    });
  } catch (error) {
    console.error('Error deleting medical condition:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to delete medical condition'
    });
  }
});

// Get condition categories for dropdown
router.get('/categories/list', async (req, res) => {
  try {
    const result = await db.query(`
      SELECT DISTINCT category, COUNT(*) as count
      FROM medical_conditions 
      WHERE category IS NOT NULL AND category != ''
      GROUP BY category
      ORDER BY category
    `);
    
    // Add common medical categories
    const commonCategories = [
      'Cardiovascular',
      'Respiratory',
      'Neurological',
      'Gastrointestinal',
      'Endocrine',
      'Musculoskeletal',
      'Dermatological',
      'Psychiatric',
      'Infectious Disease',
      'Oncological',
      'Hematological',
      'Renal',
      'Ophthalmological',
      'ENT',
      'Gynecological',
      'Pediatric',
      'Emergency',
      'Other'
    ];
    
    const existingCategories = result.rows.map(row => row.category);
    const allCategories = [...new Set([...commonCategories, ...existingCategories])].sort();
    
    res.json({
      success: true,
      data: allCategories.map(category => ({
        category,
        count: result.rows.find(row => row.category === category)?.count || 0
      }))
    });
  } catch (error) {
    console.error('Error fetching condition categories:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch condition categories'
    });
  }
});

// Get condition statistics
router.get('/stats/summary', async (req, res) => {
  try {
    const result = await db.query(`
      SELECT 
        COUNT(*) as total_conditions,
        COUNT(DISTINCT category) as total_categories,
        COUNT(CASE WHEN icd_code IS NOT NULL AND icd_code != '' THEN 1 END) as with_icd_codes,
        COUNT(CASE WHEN severity = 'High' THEN 1 END) as high_severity,
        COUNT(CASE WHEN severity = 'Medium' THEN 1 END) as medium_severity,
        COUNT(CASE WHEN severity = 'Low' THEN 1 END) as low_severity
      FROM medical_conditions
    `);
    
    res.json({
      success: true,
      data: result.rows[0]
    });
  } catch (error) {
    console.error('Error fetching condition statistics:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch condition statistics'
    });
  }
});

module.exports = router;