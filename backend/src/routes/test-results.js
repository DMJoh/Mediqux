const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs').promises;
const pdfParse = require('pdf-parse');
const router = express.Router();
const db = require('../database/db');
const { authenticateToken, addPatientFilter } = require('../middleware/auth');

// Helper function to generate descriptive PDF filename
function generatePdfFilename(testName, testDate, firstName, lastName) {
  const formatDate = (dateString) => {
    const date = new Date(dateString);
    return date.toISOString().split('T')[0]; // YYYY-MM-DD format
  };
  
  const sanitizeFilename = (str) => {
    // Replace spaces with underscores and remove special characters
    return str.replace(/[^a-zA-Z0-9]/g, '_').replace(/_+/g, '_').toLowerCase();
  };
  
  const testNameClean = sanitizeFilename(testName || 'lab_report');
  const dateFormatted = formatDate(testDate);
  const patientName = sanitizeFilename(`${firstName || ''}_${lastName || ''}`.replace(/^_|_$/g, ''));
  
  return `${testNameClean}_${dateFormatted}_${patientName || 'unknown'}.pdf`;
}

// Lab Panel Management Endpoints (must be before /:id routes)

// Get all lab panels
router.get('/panels', async (req, res) => {
  try {
    const result = await db.query(`
      SELECT p.*, 
        COUNT(pp.id) as parameter_count,
        json_agg(
          json_build_object(
            'id', pp.id,
            'parameter_name', pp.parameter_name,
            'unit', pp.unit,
            'reference_min', pp.reference_min,
            'reference_max', pp.reference_max,
            'gender_specific', pp.gender_specific,
            'aliases', pp.aliases
          ) ORDER BY pp.parameter_name
        ) FILTER (WHERE pp.id IS NOT NULL) as parameters
      FROM lab_panels p
      LEFT JOIN lab_panel_parameters pp ON p.id = pp.panel_id
      GROUP BY p.id, p.name, p.description, p.category, p.created_at, p.updated_at
      ORDER BY p.name
    `);
    
    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching lab panels:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Error fetching lab panels',
      error: error.message 
    });
  }
});

// Get specific lab panel with parameters
router.get('/panels/:id', async (req, res) => {
  try {
    const panelId = req.params.id;
    
    const panelResult = await db.query(
      'SELECT * FROM lab_panels WHERE id = $1',
      [panelId]
    );
    
    if (panelResult.rows.length === 0) {
      return res.status(404).json({ 
        success: false, 
        message: 'Lab panel not found' 
      });
    }
    
    const parametersResult = await db.query(
      'SELECT * FROM lab_panel_parameters WHERE panel_id = $1 ORDER BY parameter_name',
      [panelId]
    );
    
    const panel = panelResult.rows[0];
    panel.parameters = parametersResult.rows;
    
    res.json(panel);
  } catch (error) {
    console.error('Error fetching lab panel:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Error fetching lab panel',
      error: error.message 
    });
  }
});

// Create new lab panel
router.post('/panels', async (req, res) => {
  try {
    const { name, description, category = 'Blood', parameters = [] } = req.body;
    
    if (!name || !name.trim()) {
      return res.status(400).json({ 
        success: false, 
        message: 'Panel name is required' 
      });
    }
    
    // Check if panel with same name exists
    const existingPanel = await db.query(
      'SELECT id FROM lab_panels WHERE LOWER(name) = LOWER($1)',
      [name.trim()]
    );
    
    if (existingPanel.rows.length > 0) {
      return res.status(400).json({ 
        success: false, 
        message: 'A panel with this name already exists' 
      });
    }
    
    // Start transaction
    await db.query('BEGIN');
    
    try {
      // Create the panel
      const panelResult = await db.query(
        `INSERT INTO lab_panels (name, description, category) 
         VALUES ($1, $2, $3) 
         RETURNING *`,
        [name.trim(), description?.trim() || null, category]
      );
      
      const newPanel = panelResult.rows[0];
      
      // Add parameters if provided
      if (parameters && parameters.length > 0) {
        for (const param of parameters) {
          if (param.parameter_name && param.parameter_name.trim()) {
            await db.query(
              `INSERT INTO lab_panel_parameters 
               (panel_id, parameter_name, unit, reference_min, reference_max, gender_specific, aliases) 
               VALUES ($1, $2, $3, $4, $5, $6, $7)`,
              [
                newPanel.id,
                param.parameter_name.trim(),
                param.unit?.trim() || null,
                param.reference_min || null,
                param.reference_max || null,
                param.gender_specific || null,
                param.aliases || null
              ]
            );
          }
        }
      }
      
      await db.query('COMMIT');
      
      // Fetch the complete panel with parameters
      const completePanel = await db.query(
        `SELECT p.*, 
          json_agg(
            json_build_object(
              'id', pp.id,
              'parameter_name', pp.parameter_name,
              'unit', pp.unit,
              'reference_min', pp.reference_min,
              'reference_max', pp.reference_max,
              'gender_specific', pp.gender_specific,
              'aliases', pp.aliases
            ) ORDER BY pp.parameter_name
          ) FILTER (WHERE pp.id IS NOT NULL) as parameters
         FROM lab_panels p
         LEFT JOIN lab_panel_parameters pp ON p.id = pp.panel_id
         WHERE p.id = $1
         GROUP BY p.id`,
        [newPanel.id]
      );
      
      res.status(201).json({
        success: true,
        message: 'Lab panel created successfully',
        panel: completePanel.rows[0]
      });
    } catch (error) {
      await db.query('ROLLBACK');
      throw error;
    }
  } catch (error) {
    console.error('Error creating lab panel:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Error creating lab panel',
      error: error.message 
    });
  }
});

// Update lab panel
router.put('/panels/:id', async (req, res) => {
  try {
    const panelId = req.params.id;
    const { name, description, category } = req.body;
    
    if (!name || !name.trim()) {
      return res.status(400).json({ 
        success: false, 
        message: 'Panel name is required' 
      });
    }
    
    // Check if panel exists
    const existingPanel = await db.query(
      'SELECT id FROM lab_panels WHERE id = $1',
      [panelId]
    );
    
    if (existingPanel.rows.length === 0) {
      return res.status(404).json({ 
        success: false, 
        message: 'Lab panel not found' 
      });
    }
    
    // Check if another panel with same name exists
    const duplicatePanel = await db.query(
      'SELECT id FROM lab_panels WHERE LOWER(name) = LOWER($1) AND id != $2',
      [name.trim(), panelId]
    );
    
    if (duplicatePanel.rows.length > 0) {
      return res.status(400).json({ 
        success: false, 
        message: 'A panel with this name already exists' 
      });
    }
    
    // Update the panel
    const result = await db.query(
      `UPDATE lab_panels 
       SET name = $1, description = $2, category = $3, updated_at = CURRENT_TIMESTAMP 
       WHERE id = $4 
       RETURNING *`,
      [name.trim(), description?.trim() || null, category || 'Blood', panelId]
    );
    
    res.json({
      success: true,
      message: 'Lab panel updated successfully',
      panel: result.rows[0]
    });
  } catch (error) {
    console.error('Error updating lab panel:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Error updating lab panel',
      error: error.message 
    });
  }
});

// Delete lab panel
router.delete('/panels/:id', async (req, res) => {
  try {
    const panelId = req.params.id;
    
    // Check if panel exists
    const existingPanel = await db.query(
      'SELECT id, name FROM lab_panels WHERE id = $1',
      [panelId]
    );
    
    if (existingPanel.rows.length === 0) {
      return res.status(404).json({ 
        success: false, 
        message: 'Lab panel not found' 
      });
    }
    
    // Start transaction
    await db.query('BEGIN');
    
    try {
      // Delete parameters first
      await db.query('DELETE FROM lab_panel_parameters WHERE panel_id = $1', [panelId]);
      
      // Delete the panel
      await db.query('DELETE FROM lab_panels WHERE id = $1', [panelId]);
      
      await db.query('COMMIT');
      
      res.json({
        success: true,
        message: 'Lab panel deleted successfully'
      });
    } catch (error) {
      await db.query('ROLLBACK');
      throw error;
    }
  } catch (error) {
    console.error('Error deleting lab panel:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Error deleting lab panel',
      error: error.message 
    });
  }
});

// Add parameter to lab panel
router.post('/panels/:id/parameters', async (req, res) => {
  try {
    const panelId = req.params.id;
    const { 
      parameter_name, 
      unit, 
      reference_min, 
      reference_max, 
      gender_specific, 
      aliases 
    } = req.body;
    
    if (!parameter_name || !parameter_name.trim()) {
      return res.status(400).json({ 
        success: false, 
        message: 'Parameter name is required' 
      });
    }
    
    // Check if panel exists
    const panelExists = await db.query(
      'SELECT id FROM lab_panels WHERE id = $1',
      [panelId]
    );
    
    if (panelExists.rows.length === 0) {
      return res.status(404).json({ 
        success: false, 
        message: 'Lab panel not found' 
      });
    }
    
    // Check if parameter already exists in this panel
    const parameterExists = await db.query(
      'SELECT id FROM lab_panel_parameters WHERE panel_id = $1 AND LOWER(parameter_name) = LOWER($2)',
      [panelId, parameter_name.trim()]
    );
    
    if (parameterExists.rows.length > 0) {
      return res.status(400).json({ 
        success: false, 
        message: 'Parameter already exists in this panel' 
      });
    }
    
    // Add the parameter
    const result = await db.query(
      `INSERT INTO lab_panel_parameters 
       (panel_id, parameter_name, unit, reference_min, reference_max, gender_specific, aliases) 
       VALUES ($1, $2, $3, $4, $5, $6, $7) 
       RETURNING *`,
      [
        panelId,
        parameter_name.trim(),
        unit?.trim() || null,
        reference_min || null,
        reference_max || null,
        gender_specific || null,
        aliases || null
      ]
    );
    
    res.status(201).json({
      success: true,
      message: 'Parameter added successfully',
      parameter: result.rows[0]
    });
  } catch (error) {
    console.error('Error adding parameter to panel:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Error adding parameter to panel',
      error: error.message 
    });
  }
});

// Update parameter in lab panel
router.put('/panels/:panelId/parameters/:parameterId', async (req, res) => {
  try {
    const { panelId, parameterId } = req.params;
    const { 
      parameter_name, 
      unit, 
      reference_min, 
      reference_max, 
      gender_specific, 
      aliases 
    } = req.body;
    
    if (!parameter_name || !parameter_name.trim()) {
      return res.status(400).json({ 
        success: false, 
        message: 'Parameter name is required' 
      });
    }
    
    // Check if parameter exists
    const parameterExists = await db.query(
      'SELECT id FROM lab_panel_parameters WHERE id = $1 AND panel_id = $2',
      [parameterId, panelId]
    );
    
    if (parameterExists.rows.length === 0) {
      return res.status(404).json({ 
        success: false, 
        message: 'Parameter not found in this panel' 
      });
    }
    
    // Check if another parameter with same name exists in this panel
    const duplicateParameter = await db.query(
      'SELECT id FROM lab_panel_parameters WHERE panel_id = $1 AND LOWER(parameter_name) = LOWER($2) AND id != $3',
      [panelId, parameter_name.trim(), parameterId]
    );
    
    if (duplicateParameter.rows.length > 0) {
      return res.status(400).json({ 
        success: false, 
        message: 'Another parameter with this name already exists in this panel' 
      });
    }
    
    // Update the parameter
    const result = await db.query(
      `UPDATE lab_panel_parameters 
       SET parameter_name = $1, unit = $2, reference_min = $3, reference_max = $4, 
           gender_specific = $5, aliases = $6, updated_at = CURRENT_TIMESTAMP
       WHERE id = $7 AND panel_id = $8 
       RETURNING *`,
      [
        parameter_name.trim(),
        unit?.trim() || null,
        reference_min || null,
        reference_max || null,
        gender_specific || null,
        aliases || null,
        parameterId,
        panelId
      ]
    );
    
    res.json({
      success: true,
      message: 'Parameter updated successfully',
      parameter: result.rows[0]
    });
  } catch (error) {
    console.error('Error updating parameter:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Error updating parameter',
      error: error.message 
    });
  }
});

// Delete parameter from lab panel
router.delete('/panels/:panelId/parameters/:parameterId', async (req, res) => {
  try {
    const { panelId, parameterId } = req.params;
    
    // Check if parameter exists
    const parameterExists = await db.query(
      'SELECT id, parameter_name FROM lab_panel_parameters WHERE id = $1 AND panel_id = $2',
      [parameterId, panelId]
    );
    
    if (parameterExists.rows.length === 0) {
      return res.status(404).json({ 
        success: false, 
        message: 'Parameter not found in this panel' 
      });
    }
    
    // Delete the parameter
    await db.query(
      'DELETE FROM lab_panel_parameters WHERE id = $1 AND panel_id = $2',
      [parameterId, panelId]
    );
    
    res.json({
      success: true,
      message: 'Parameter deleted successfully'
    });
  } catch (error) {
    console.error('Error deleting parameter:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Error deleting parameter',
      error: error.message 
    });
  }
});

// Configure multer for PDF uploads
const storage = multer.diskStorage({
  destination: async (req, file, cb) => {
    const uploadsDir = path.join(__dirname, '../../uploads/lab-reports');
    try {
      await fs.mkdir(uploadsDir, { recursive: true });
      cb(null, uploadsDir);
    } catch (error) {
      console.error('Error creating uploads directory:', error);
      cb(error);
    }
  },
  filename: (req, file, cb) => {
    // Generate unique filename with timestamp
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, `lab-report-${uniqueSuffix}${path.extname(file.originalname)}`);
  }
});

const upload = multer({
  storage: storage,
  limits: {
    fileSize: 10 * 1024 * 1024 // 10MB limit
  },
  fileFilter: (req, file, cb) => {
    if (file.mimetype === 'application/pdf') {
      cb(null, true);
    } else {
      cb(new Error('Only PDF files are allowed'));
    }
  }
});

// Local PDF parsing patterns for common lab values
const LAB_PATTERNS = {
  // Hemoglobin patterns - handles both formats
  hemoglobin: [
    // Standard format: "Hemoglobin: 15.5 g/dL"
    /h[ae]moglobin[:\s]*(\d+(?:\.\d+)?)\s*g[m]?\/dl/i,
    /hb[:\s]*(\d+(?:\.\d+)?)\s*g[m]?\/dl/i,
    // Indian format: "15.5 HAEMOGLOBIN (HB)" followed by unit
    /(\d+(?:\.\d+)?)\s+h[ae]moglobin\s*\(hb\).*?g[m]?\/dl/is,
    /(\d+(?:\.\d+)?)\s+hb\b.*?g[m]?\/dl/is
  ],
  
  // WBC patterns
  wbc: [
    // Standard format
    /wbc\s*count[:\s]*(\d+(?:,\d+)?)\s*\/[μu]l/i,
    /white\s*blood\s*cell[:\s]*(\d+(?:,\d+)?)/i,
    // Indian format: "8,570 TOTAL WBC COUNT (TC)" followed by "/cumm"
    /([\d,]+)\s+total\s+wbc\s+count.*?\/cumm/is,
    /([\d,]+)\s+wbc\s+count.*?\/cumm/is
  ],
  
  // RBC patterns
  rbc: [
    // Standard format
    /rbc\s*count[:\s]*(\d+(?:\.\d+)?)\s*million\/[μu]l/i,
    /red\s*blood\s*cell[:\s]*(\d+(?:\.\d+)?)/i,
    // Indian format: "6.15 RBC" followed by "mill/cumm"
    /(\d+(?:\.\d+)?)\s+rbc\b.*?mill\/cumm/is
  ],
  
  // Platelet patterns
  platelets: [
    // Standard format
    /platelet\s*count[:\s]*(\d+(?:,\d+)?)\s*\/[μu]l/i,
    /platelets?[:\s]*(\d+(?:,\d+)?)/i,
    // Indian format: "3.93 Lakhs/Cumm PLATELET COUNT"
    /(\d+(?:\.\d+)?)\s+lakhs?\/cumm\s+platelet\s+count/is,
    /(\d+(?:\.\d+)?)\s+platelet\s+count.*?lakhs?\/cumm/is
  ],
  
  // Hematocrit/PCV patterns
  hematocrit: [
    /hematocrit[:\s]*(\d+(?:\.\d+)?)\s*%?/i,
    /hct[:\s]*(\d+(?:\.\d+)?)/i,
    /pcv[:\s]*(\d+(?:\.\d+)?)\s*%/i,
    // Indian format: "47.3 PACKED CELL VOLUME (PCV)"
    /(\d+(?:\.\d+)?)\s+packed\s+cell\s+volume.*?%/is
  ],
  
  // ESR patterns
  esr: [
    /esr[:\s]*(\d+(?:\.\d+)?)\s*mm\/hr/i,
    /erythrocyte\s*sedimentation\s*rate[:\s]*(\d+(?:\.\d+)?)/i,
    // Indian format: "4 ERYTHROCYTE SEDIMENTATION RATE (ESR)"
    /(\d+(?:\.\d+)?)\s+erythrocyte\s+sedimentation\s+rate.*?mm\/hr/is
  ],
  
  // Neutrophils patterns
  neutrophils: [
    /neutrophils?[:\s]*(\d+(?:\.\d+)?)\s*%/i,
    // Indian format: "53.6 NEUTROPHILS"
    /(\d+(?:\.\d+)?)\s+neutrophils.*?%/is
  ],
  
  // Lymphocytes patterns
  lymphocytes: [
    /lymphocytes?[:\s]*(\d+(?:\.\d+)?)\s*%/i,
    // Indian format: "39.7 LYMPHOCYTES"
    /(\d+(?:\.\d+)?)\s+lymphocytes.*?%/is
  ],
  
  // Eosinophils patterns
  eosinophils: [
    /eosinophils?[:\s]*(\d+(?:\.\d+)?)\s*%/i,
    // Indian format: "1.5 EOSINOPHILS"
    /(\d+(?:\.\d+)?)\s+eosinophils.*?%/is
  ],
  
  // Monocytes patterns
  monocytes: [
    /monocytes?[:\s]*(\d+(?:\.\d+)?)\s*%/i,
    // Indian format: "3.6 MONOCYTES"
    /(\d+(?:\.\d+)?)\s+monocytes.*?%/is
  ],
  
  // Basophils patterns
  basophils: [
    /basophils?[:\s]*(\d+(?:\.\d+)?)\s*%/i,
    // Indian format: "1.6 BASOPHILS"
    /(\d+(?:\.\d+)?)\s+basophils.*?%/is
  ],
  
  // MCV patterns
  mcv: [
    /mcv[:\s]*(\d+(?:\.\d+)?)\s*fl/i,
    // Indian format: "76.9 MCV"
    /(\d+(?:\.\d+)?)\s+mcv\b.*?cubic\/micro/is
  ],
  
  // MCH patterns
  mch: [
    /mch[:\s]*(\d+(?:\.\d+)?)\s*pg/i,
    // Indian format: "25.3 MCH"
    /(\d+(?:\.\d+)?)\s+mch\b.*?pico\s+gram/is
  ],
  
  // MCHC patterns
  mchc: [
    /mchc[:\s]*(\d+(?:\.\d+)?)\s*%/i,
    // Indian format: "32.8 MCHC"
    /(\d+(?:\.\d+)?)\s+mchc\b.*?%/is
  ],
  
  // Glucose patterns (for future lab reports)
  glucose: [
    /glucose[:\s]*(\d+(?:\.\d+)?)\s*mg\/dl/i,
    /blood\s*glucose[:\s]*(\d+(?:\.\d+)?)\s*mg\/dl/i,
    /fasting\s*glucose[:\s]*(\d+(?:\.\d+)?)/i,
    /(\d+(?:\.\d+)?)\s+glucose.*?mg\/dl/is
  ],
  
  // Cholesterol patterns
  cholesterol: [
    /total\s*cholesterol[:\s]*(\d+(?:\.\d+)?)\s*mg\/dl/i,
    /cholesterol[:\s]*(\d+(?:\.\d+)?)\s*mg\/dl/i,
    /(\d+(?:\.\d+)?)\s+total\s+cholesterol.*?mg\/dl/is
  ],
  
  // Kidney function
  creatinine: [
    /creatinine[:\s]*(\d+(?:\.\d+)?)\s*mg\/dl/i,
    /serum\s*creatinine[:\s]*(\d+(?:\.\d+)?)/i,
    /(\d+(?:\.\d+)?)\s+creatinine.*?mg\/dl/is
  ],
  
  bun: [
    /bun[:\s]*(\d+(?:\.\d+)?)\s*mg\/dl/i,
    /blood\s*urea\s*nitrogen[:\s]*(\d+(?:\.\d+)?)/i,
    /urea[:\s]*(\d+(?:\.\d+)?)\s*mg\/dl/i,
    /(\d+(?:\.\d+)?)\s+bun.*?mg\/dl/is
  ]
};

// Reference ranges for common lab values
const REFERENCE_RANGES = {
  // Blood chemistry
  glucose: { min: 70, max: 100, unit: 'mg/dL' },
  cholesterol: { max: 200, unit: 'mg/dL' },
  creatinine: { min: 0.6, max: 1.2, unit: 'mg/dL' },
  bun: { min: 7, max: 20, unit: 'mg/dL' },
  
  // CBC parameters - Adult Male ranges (as per report)
  hemoglobin: { min: 13.0, max: 16.0, unit: 'g/dL' }, // Male range
  hematocrit: { min: 40, max: 50, unit: '%' }, // Male range (PCV)
  wbc: { min: 4000, max: 10000, unit: '/cumm' },
  rbc: { min: 4.5, max: 5.5, unit: 'mill/cumm' }, // Male range
  platelets: { min: 1.5, max: 4.1, unit: 'Lakhs/cumm' }, // Convert to lakhs
  esr: { min: 0, max: 10, unit: 'mm/hr' }, // Male range
  
  // Differential count percentages
  neutrophils: { min: 40, max: 80, unit: '%' },
  lymphocytes: { min: 20, max: 40, unit: '%' },
  eosinophils: { min: 0, max: 6, unit: '%' },
  monocytes: { min: 0, max: 10, unit: '%' },
  basophils: { min: 0, max: 2, unit: '%' },
  
  // RBC indices
  mcv: { min: 83, max: 101, unit: 'fL' },
  mch: { min: 27, max: 32, unit: 'pg' },
  mchc: { min: 31.5, max: 34.5, unit: '%' }
};

// Generic patterns to extract ANY potential lab values (restored working version)
const GENERIC_EXTRACTION_PATTERNS = [
  // Pattern 1: "15.5 HAEMOGLOBIN (HB) gm/dL" - Value first, then parameter and unit
  /(\d+(?:\.\d+)?(?:,\d{3})*)\s+([A-Za-z][A-Za-z\s\(\)\-\/]{2,50}?)\s+([a-zA-Z\/\%μℓµ\-\+]+(?:\s*\/\s*[a-zA-Z]+)*)/g,
  
  // Pattern 2: "Glucose: 95 mg/dL" - Parameter first, then value and unit  
  /([A-Za-z][A-Za-z\s\(\)\-\/]{2,50}?)[:\s]+(\d+(?:\.\d+)?(?:,\d{3})*)\s*([a-zA-Z\/\%μℓµ\-\+]+(?:\s*\/\s*[a-zA-Z]+)*)/g,
  
  // Pattern 3: "Hemoglobin 15.5" - Parameter and value, no clear unit
  /([A-Za-z][A-Za-z\s\(\)\-\/]{2,50}?)\s+(\d+(?:\.\d+)?(?:,\d{3})*)\s*(?=\s|$)/g,
  
  // Pattern 4: Handle percentage values "53.6 NEUTROPHILS %" - but capture more flexibly
  /(\d+(?:\.\d+)?(?:,\d{3})*)\s+([A-Za-z][A-Za-z\s\(\)\-\/]{2,50}?)\s*(\%|percent)/g,
  
  // Pattern 5: Handle values with "Lakhs" "3.93 Lakhs/Cumm PLATELET COUNT"
  /(\d+(?:\.\d+)?)\s+(lakhs?\/\w+|million\/\w+)\s+([A-Za-z][A-Za-z\s\(\)\-\/]{2,50}?)/gi
];

// Unit standardization mapping
const UNIT_STANDARDIZATION = {
  'gm/dl': 'g/dL',
  'gm/dL': 'g/dL', 
  'GM/DL': 'g/dL',
  '/ul': '/µL',
  '/UL': '/µL',
  'per ul': '/µL',
  'per µl': '/µL',
  'million/ul': 'million/µL',
  'million/UL': 'million/µL',
  'lakhs/cumm': 'Lakhs/µL',
  'LAKHS/CUMM': 'Lakhs/µL'
};

// Parameter name standardization  
const PARAMETER_STANDARDIZATION = {
  'HAEMOGLOBIN': 'Hemoglobin',
  'HAEMOGLOBIN (HB)': 'Hemoglobin',
  'HB': 'Hemoglobin',
  'HGB': 'Hemoglobin', 
  'RBC COUNT': 'Red Blood Cell Count',
  'WBC COUNT': 'White Blood Cell Count',
  'PLATELET COUNT': 'Platelet Count',
  'PLT COUNT': 'Platelet Count',
  'HEMATOCRIT': 'Hematocrit',
  'HCT': 'Hematocrit',
  'PACKED CELL VOLUME': 'Hematocrit'
};

// Calculate confidence score based on pattern type and context
function calculatePatternConfidence(patternIndex, parameter, unit) {
  let confidence = 0.5; // Base confidence
  
  // Higher confidence for specific patterns
  if (patternIndex === 0) confidence = 0.9; // Indian format with exact unit match
  if (patternIndex === 1) confidence = 0.85; // COUNT format
  if (patternIndex === 2) confidence = 0.8; // Percentage format
  if (patternIndex === 3) confidence = 0.85; // Ratio format
  if (patternIndex === 4) confidence = 0.9; // Colon format
  if (patternIndex === 5) confidence = 0.75; // Lakhs format
  if (patternIndex === 6) confidence = 0.7; // Simple format
  
  // Boost confidence for known medical units
  const medicalUnits = ['g/dL', 'mg/dL', 'mEq/L', '/µL', 'million/µL', '%', 'U/L'];
  if (medicalUnits.includes(unit)) confidence += 0.1;
  
  // Boost confidence for known lab parameters
  const commonLabParams = ['hemoglobin', 'hematocrit', 'platelet', 'glucose', 'creatinine'];
  if (commonLabParams.some(param => parameter?.toLowerCase().includes(param))) confidence += 0.1;
  
  return Math.min(confidence, 1.0);
}

// Enhanced function to extract ALL potential lab values from text
function extractLabValues(text) {
  const allMatches = [];
  const extractedValues = [];
  
  // Use generic patterns to find ALL potential lab values (restored working approach)
  GENERIC_EXTRACTION_PATTERNS.forEach((pattern, patternIndex) => {
    const matches = [...text.matchAll(pattern)];
    matches.forEach(match => {
      let value, parameter, unit;
      
      // Determine which capture group is which based on pattern type
      if (patternIndex === 0 || patternIndex === 3) {
        // Value first patterns: "15.5 HAEMOGLOBIN gm/dL"
        value = match[1];
        parameter = match[2];
        unit = match[3] || '';
      } else if (patternIndex === 1) {
        // Parameter first patterns: "Glucose: 95 mg/dL"
        parameter = match[1];
        value = match[2];
        unit = match[3] || '';
      } else if (patternIndex === 2) {
        // Parameter and value only: "Hemoglobin 15.5"
        parameter = match[1];
        value = match[2];
        unit = '';
      } else if (patternIndex === 4) {
        // Special Lakhs pattern: "3.93 Lakhs/Cumm PLATELET COUNT"
        value = match[1];
        unit = match[2];
        parameter = match[3];
      }
      
      // Apply unit standardization
      let standardizedUnit = unit?.trim().toLowerCase();
      if (UNIT_STANDARDIZATION[standardizedUnit]) {
        unit = UNIT_STANDARDIZATION[standardizedUnit];
      }
      
      allMatches.push({
        value: value?.trim(),
        parameter: parameter?.trim(),
        unit: unit?.trim(),
        fullMatch: match[0],
        patternUsed: patternIndex
      });
    });
  });
  
  
  // Process and clean up the matches (restored working approach)
  allMatches.forEach(match => {
    const numericValue = parseFloat(match.value?.replace(/,/g, ''));
    if (isNaN(numericValue) || !match.parameter || match.parameter.length < 2) {
      return; // Skip invalid matches
    }
    
    // Clean up parameter name
    const cleanParameter = match.parameter
      .replace(/\s+/g, ' ')
      .replace(/[()]/g, '')
      .trim()
      .toLowerCase();
    
    // Skip common false positives (but less restrictive)
    if (cleanParameter.includes('reference') || 
        cleanParameter.includes('range') ||
        cleanParameter.includes('sample') ||
        cleanParameter.includes('years') ||
        cleanParameter.includes('adult') ||
        cleanParameter.includes('male') ||
        cleanParameter.includes('female') ||
        cleanParameter.length < 2) {
      return;
    }
    
    // Clean up unit
    let cleanUnit = match.unit?.replace(/[()]/g, '').trim() || '';
    
    // Try to get better status using existing knowledge
    let status = 'normal';
    const parameterKey = findParameterKey(cleanParameter);
    if (parameterKey) {
      const refRange = REFERENCE_RANGES[parameterKey];
      if (refRange) {
        if (refRange.min && numericValue < refRange.min) status = 'low';
        else if (refRange.max && numericValue > refRange.max) status = 'high';
        
        // Use known unit if unit is empty
        if (!cleanUnit && refRange.unit) {
          cleanUnit = refRange.unit;
        }
      }
    }
    
    extractedValues.push({
      parameter_name: formatParameterForDisplay(cleanParameter),
      value: numericValue,
      unit: cleanUnit || null,
      reference_range: parameterKey ? formatReferenceRange(REFERENCE_RANGES[parameterKey]) : null,
      status: status,
      raw_match: match.fullMatch,
      confidence: calculateConfidence(match)
    });
  });
  
  // Remove duplicates based on parameter name similarity
  const uniqueValues = removeDuplicateParameters(extractedValues);
  
  return uniqueValues;
}

// Helper function to find parameter key from our existing knowledge
function findParameterKey(parameterText) {
  const text = parameterText.toLowerCase();
  
  // Check for known parameter variations
  if (text.includes('hemoglobin') || text.includes('haemoglobin') || text === 'hb') return 'hemoglobin';
  if (text.includes('wbc') || text.includes('white blood cell') || text.includes('total wbc')) return 'wbc';
  if (text.includes('rbc') || text.includes('red blood cell')) return 'rbc';
  if (text.includes('platelet')) return 'platelets';
  if (text.includes('hematocrit') || text.includes('packed cell volume') || text.includes('pcv')) return 'hematocrit';
  if (text.includes('esr') || text.includes('erythrocyte sedimentation')) return 'esr';
  if (text.includes('neutrophil')) return 'neutrophils';
  if (text.includes('lymphocyte')) return 'lymphocytes';
  if (text.includes('eosinophil')) return 'eosinophils';
  if (text.includes('monocyte')) return 'monocytes';
  if (text.includes('basophil')) return 'basophils';
  if (text === 'mcv') return 'mcv';
  if (text === 'mch') return 'mch';
  if (text === 'mchc') return 'mchc';
  if (text.includes('glucose')) return 'glucose';
  if (text.includes('creatinine')) return 'creatinine';
  if (text.includes('cholesterol')) return 'cholesterol';
  
  return null;
}

// Format parameter name for display
function formatParameterForDisplay(parameterText) {
  const text = parameterText.toLowerCase();
  
  // Use known good names
  const parameterKey = findParameterKey(text);
  if (parameterKey) {
    return formatParameterName(parameterKey);
  }
  
  // Otherwise, clean up the raw text
  return parameterText
    .split(' ')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ')
    .replace(/\s+/g, ' ')
    .trim();
}

// Calculate confidence score for extracted value
function calculateConfidence(match) {
  let confidence = 0.5; // Base confidence
  
  // Higher confidence for known parameters
  if (findParameterKey(match.parameter)) confidence += 0.3;
  
  // Higher confidence if unit is present and looks medical
  if (match.unit) {
    const unit = match.unit.toLowerCase();
    if (unit.includes('dl') || unit.includes('cumm') || unit.includes('%') || 
        unit.includes('μl') || unit.includes('mg') || unit.includes('lakhs')) {
      confidence += 0.2;
    }
  }
  
  return Math.min(confidence, 1.0);
}

// Remove duplicate parameters based on similarity
function removeDuplicateParameters(extractedValues) {
  const unique = [];
  const seen = new Set();
  
  extractedValues
    .sort((a, b) => b.confidence - a.confidence) // Higher confidence first
    .forEach(value => {
      const key = value.parameter_name.toLowerCase().replace(/[^a-z]/g, '');
      if (!seen.has(key)) {
        seen.add(key);
        unique.push(value);
      }
    });
  
  return unique;
}

// Helper functions
function formatParameterName(key) {
  const names = {
    // CBC parameters
    hemoglobin: 'Hemoglobin',
    hematocrit: 'Hematocrit (PCV)',
    wbc: 'WBC Count',
    rbc: 'RBC Count',
    platelets: 'Platelet Count',
    esr: 'ESR',
    
    // Differential count
    neutrophils: 'Neutrophils',
    lymphocytes: 'Lymphocytes',
    eosinophils: 'Eosinophils',
    monocytes: 'Monocytes',
    basophils: 'Basophils',
    
    // RBC indices
    mcv: 'MCV',
    mch: 'MCH',
    mchc: 'MCHC',
    
    // Chemistry
    glucose: 'Glucose',
    cholesterol: 'Total Cholesterol',
    creatinine: 'Creatinine',
    bun: 'BUN'
  };
  return names[key] || key.toUpperCase();
}

function formatReferenceRange(refRange) {
  if (!refRange) return null;
  if (refRange.min && refRange.max) return `${refRange.min}-${refRange.max}`;
  if (refRange.max) return `<${refRange.max}`;
  if (refRange.min) return `>${refRange.min}`;
  return null;
}

function getUnitFromText(text) {
  const unitPatterns = [
    /mg\/dl/i,
    /g\/dl/i,
    /μg\/dl/i,
    /ng\/dl/i,
    /u\/l/i,
    /iu\/l/i,
    /miu\/l/i,
    /meq\/l/i,
    /\/μl/i,
    /%/
  ];
  
  for (const pattern of unitPatterns) {
    const match = text.match(pattern);
    if (match) return match[0];
  }
  return null;
}

// Get all test results (with RBAC filtering)
router.get('/', authenticateToken, addPatientFilter, async (req, res) => {
  try {
    const { search, patient_id, test_type, date_range } = req.query;
    
    let query = `
      SELECT 
        tr.id,
        tr.patient_id,
        tr.appointment_id,
        tr.test_name,
        tr.test_type,
        tr.test_date,
        tr.pdf_file_path,
        tr.extracted_text,
        tr.structured_data,
        tr.institution_id,
        tr.created_at,
        tr.updated_at,
        
        -- Patient information
        p.first_name as patient_first_name,
        p.last_name as patient_last_name,
        p.phone as patient_phone,
        p.email as patient_email,
        
        -- Institution information
        i.name as institution_name,
        
        -- Appointment information
        a.appointment_date,
        
        -- Lab values (as JSON array)
        COALESCE(
          JSON_AGG(
            CASE WHEN lv.id IS NOT NULL 
            THEN JSON_BUILD_OBJECT(
              'id', lv.id,
              'parameter_name', lv.parameter_name,
              'value', lv.value,
              'unit', lv.unit,
              'reference_range', lv.reference_range,
              'status', lv.status
            )
            ELSE NULL END
          ) FILTER (WHERE lv.id IS NOT NULL), 
          '[]'::json
        ) as lab_values
        
      FROM test_results tr
      LEFT JOIN patients p ON tr.patient_id = p.id
      LEFT JOIN institutions i ON tr.institution_id = i.id
      LEFT JOIN appointments a ON tr.appointment_id = a.id
      LEFT JOIN lab_values lv ON tr.id = lv.test_result_id
      WHERE 1=1
    `;
    
    const queryParams = [];
    let paramIndex = 1;
    
    // Apply RBAC patient filtering first
    if (req.patientFilter && req.patientFilter !== 'none') {
      query += ` AND tr.patient_id = $${paramIndex}`;
      queryParams.push(req.patientFilter);
      paramIndex++;
    } else if (req.patientFilter === 'none') {
      // User has no patient access
      return res.json({
        success: true,
        data: [],
        count: 0
      });
    }
    
    // Add filters if provided
    if (search) {
      query += ` AND (
        tr.test_name ILIKE $${paramIndex} OR 
        p.first_name ILIKE $${paramIndex} OR 
        p.last_name ILIKE $${paramIndex} OR
        tr.test_type ILIKE $${paramIndex}
      )`;
      queryParams.push(`%${search}%`);
      paramIndex++;
    }
    
    if (patient_id) {
      query += ` AND tr.patient_id = $${paramIndex}`;
      queryParams.push(patient_id);
      paramIndex++;
    }
    
    if (test_type) {
      query += ` AND tr.test_type = $${paramIndex}`;
      queryParams.push(test_type);
      paramIndex++;
    }
    
    if (date_range) {
      const daysAgo = {
        'week': 7,
        'month': 30,
        '3months': 90,
        'year': 365
      };
      
      if (daysAgo[date_range]) {
        query += ` AND tr.test_date >= CURRENT_DATE - INTERVAL '${daysAgo[date_range]} days'`;
      }
    }
    
    query += ` 
      GROUP BY tr.id, p.id, i.id, a.id
      ORDER BY tr.test_date DESC, tr.created_at DESC
    `;
    
    const result = await db.query(query, queryParams);
    
    res.json({
      success: true,
      data: result.rows,
      count: result.rows.length
    });
  } catch (error) {
    console.error('Error fetching test results:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch test results'
    });
  }
});

// Get single test result by ID
router.get('/:id', authenticateToken, addPatientFilter, async (req, res) => {
  try {
    const { id } = req.params;
    
    const result = await db.query(`
      SELECT 
        tr.*,
        
        -- Patient information
        p.first_name as patient_first_name,
        p.last_name as patient_last_name,
        p.phone as patient_phone,
        p.email as patient_email,
        
        -- Institution information
        i.name as institution_name,
        
        -- Appointment information
        a.appointment_date,
        a.type as appointment_type,
        
        -- Lab values
        COALESCE(
          JSON_AGG(
            CASE WHEN lv.id IS NOT NULL 
            THEN JSON_BUILD_OBJECT(
              'id', lv.id,
              'parameter_name', lv.parameter_name,
              'value', lv.value,
              'unit', lv.unit,
              'reference_range', lv.reference_range,
              'status', lv.status,
              'created_at', lv.created_at
            )
            ELSE NULL END
          ) FILTER (WHERE lv.id IS NOT NULL), 
          '[]'::json
        ) as lab_values
        
      FROM test_results tr
      LEFT JOIN patients p ON tr.patient_id = p.id
      LEFT JOIN institutions i ON tr.institution_id = i.id
      LEFT JOIN appointments a ON tr.appointment_id = a.id
      LEFT JOIN lab_values lv ON tr.id = lv.test_result_id
      WHERE tr.id = $1
      GROUP BY tr.id, p.id, i.id, a.id
      LIMIT 1
    `, [id]);
    
    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Test result not found'
      });
    }
    
    res.json({
      success: true,
      data: result.rows[0]
    });
  } catch (error) {
    console.error('Error fetching test result:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch test result'
    });
  }
});

// Upload PDF report with optional parsing and value suggestions
router.post('/upload', upload.single('pdfFile'), authenticateToken, addPatientFilter, async (req, res) => {
  try {
    const {
      patientId,
      appointmentId,
      testName,
      testType,
      testDate,
      institutionId,
      enableParsing = 'true' // Optional parsing flag
    } = req.body;
    
    const pdfFile = req.file;
    
    // Basic validation
    if (!patientId || !testName || !testType || !testDate || !pdfFile) {
      return res.status(400).json({
        success: false,
        error: 'Patient, test name, test type, test date, and PDF file are required'
      });
    }
    
    // Verify patient exists
    const patientCheck = await db.query('SELECT id FROM patients WHERE id = $1', [patientId]);
    if (patientCheck.rows.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'Patient not found'
      });
    }
    
    
    let extractedText = null;
    let suggestedValues = [];
    let parsingError = null;
    
    // Attempt PDF parsing if enabled (optional enhancement)
    if (enableParsing === 'true') {
      try {
        const pdfBuffer = await fs.readFile(pdfFile.path);
        const pdfData = await pdfParse(pdfBuffer);
        extractedText = pdfData.text;
        
        if (extractedText && extractedText.length > 50) {
          suggestedValues = extractLabValues(extractedText);
          console.log(`Extracted ${suggestedValues.length} potential lab values`);
        }
      } catch (error) {
        console.error('PDF parsing failed (non-critical):', error);
        parsingError = error.message;
        // Continue with upload even if parsing fails
      }
    }
    
    const client = await db.getClient();
    
    try {
      await client.query('BEGIN');
      
      // Create test result record with PDF file (always save PDF regardless of parsing)
      const testResultQuery = `
        INSERT INTO test_results (
          patient_id, appointment_id, test_name, test_type, test_date, 
          institution_id, pdf_file_path, extracted_text, structured_data
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
        RETURNING *
      `;
      
      const testResult = await client.query(testResultQuery, [
        patientId,
        appointmentId || null,
        testName,
        testType,
        testDate,
        institutionId || null,
        pdfFile.path,
        extractedText,
        JSON.stringify({ suggested_values: suggestedValues, parsing_error: parsingError })
      ]);
      
      await client.query('COMMIT');
      
      res.status(200).json({
        success: true,
        message: 'PDF lab report uploaded successfully',
        data: {
          id: testResult.rows[0].id,
          testName,
          fileName: pdfFile.originalname,
          parsingEnabled: enableParsing === 'true',
          parsingSuccess: !parsingError && suggestedValues.length > 0,
          suggestedValues: suggestedValues, // Send suggested values to frontend
          parsingError: parsingError
        }
      });
      
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
    
  } catch (error) {
    console.error('Error uploading lab report:', error);
    
    // Clean up uploaded file on error
    if (req.file && req.file.path) {
      try {
        await fs.unlink(req.file.path);
      } catch (unlinkError) {
        console.error('Error deleting uploaded file:', unlinkError);
      }
    }
    
    res.status(500).json({
      success: false,
      error: 'Failed to upload lab report'
    });
  }
});

// Add lab values to existing test result (used after PDF upload with suggestions)
router.post('/:id/lab-values', authenticateToken, addPatientFilter, async (req, res) => {
  try {
    const { id } = req.params;
    const { lab_values } = req.body;
    
    // Validate input
    if (!lab_values || !Array.isArray(lab_values) || lab_values.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'Lab values array is required'
      });
    }
    
    // Verify test result exists
    const testResultCheck = await db.query('SELECT id FROM test_results WHERE id = $1', [id]);
    if (testResultCheck.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Test result not found'
      });
    }
    
    const client = await db.getClient();
    
    try {
      await client.query('BEGIN');
      
      // Delete existing lab values for this test result
      await client.query('DELETE FROM lab_values WHERE test_result_id = $1', [id]);
      
      // Insert new lab values
      for (const labValue of lab_values) {
        if (labValue.parameter_name && labValue.value !== null && labValue.value !== '') {
          await client.query(`
            INSERT INTO lab_values (
              test_result_id, parameter_name, value, unit, reference_range, status
            ) VALUES ($1, $2, $3, $4, $5, $6)
          `, [
            id,
            labValue.parameter_name,
            labValue.value,
            labValue.unit || null,
            labValue.reference_range || null,
            labValue.status || 'normal'
          ]);
        }
      }
      
      await client.query('COMMIT');
      
      res.json({
        success: true,
        message: 'Lab values saved successfully',
        count: lab_values.length
      });
      
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
    
  } catch (error) {
    console.error('Error saving lab values:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to save lab values'
    });
  }
});

// Create test result with manual lab values
router.post('/', authenticateToken, addPatientFilter, async (req, res) => {
  try {
    const {
      patient_id,
      appointment_id,
      test_name,
      test_type,
      test_date,
      institution_id,
      lab_values
    } = req.body;
    
    // Basic validation
    if (!patient_id || !test_name || !test_type || !test_date) {
      return res.status(400).json({
        success: false,
        error: 'Patient, test name, test type, and test date are required'
      });
    }
    
    // Verify patient exists
    const patientCheck = await db.query('SELECT id FROM patients WHERE id = $1', [patient_id]);
    if (patientCheck.rows.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'Patient not found'
      });
    }
    
    const client = await db.getClient();
    
    try {
      await client.query('BEGIN');
      
      // Create test result record
      const testResultQuery = `
        INSERT INTO test_results (
          patient_id, appointment_id, test_name, test_type, test_date, institution_id
        ) VALUES ($1, $2, $3, $4, $5, $6)
        RETURNING *
      `;
      
      const testResult = await client.query(testResultQuery, [
        patient_id,
        appointment_id || null,
        test_name,
        test_type,
        test_date,
        institution_id || null
      ]);
      
      const testResultId = testResult.rows[0].id;
      
      // Insert lab values if provided
      if (lab_values && Array.isArray(lab_values) && lab_values.length > 0) {
        for (const labValue of lab_values) {
          await client.query(`
            INSERT INTO lab_values (
              test_result_id, parameter_name, value, unit, reference_range, status
            ) VALUES ($1, $2, $3, $4, $5, $6)
          `, [
            testResultId,
            labValue.parameter_name,
            labValue.value,
            labValue.unit || null,
            labValue.reference_range || null,
            labValue.status || 'normal'
          ]);
        }
      }
      
      await client.query('COMMIT');
      
      res.status(201).json({
        success: true,
        data: testResult.rows[0],
        message: 'Lab report created successfully'
      });
      
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
    
  } catch (error) {
    console.error('Error creating test result:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to create test result'
    });
  }
});

// Update test result and lab values
router.put('/:id', authenticateToken, addPatientFilter, async (req, res) => {
  try {
    const { id } = req.params;
    const {
      test_name,
      test_type,
      test_date,
      institution_id,
      lab_values
    } = req.body;
    
    const client = await db.getClient();
    
    try {
      await client.query('BEGIN');
      
      // Update test result record
      const updateQuery = `
        UPDATE test_results SET
          test_name = $1,
          test_type = $2,
          test_date = $3,
          institution_id = $4,
          updated_at = CURRENT_TIMESTAMP
        WHERE id = $5
        RETURNING *
      `;
      
      const result = await client.query(updateQuery, [
        test_name,
        test_type,
        test_date,
        institution_id || null,
        id
      ]);
      
      if (result.rows.length === 0) {
        await client.query('ROLLBACK');
        return res.status(404).json({
          success: false,
          error: 'Test result not found'
        });
      }
      
      // Update lab values if provided
      if (lab_values && Array.isArray(lab_values)) {
        // Delete existing lab values
        await client.query('DELETE FROM lab_values WHERE test_result_id = $1', [id]);
        
        // Insert new lab values
        for (const labValue of lab_values) {
          await client.query(`
            INSERT INTO lab_values (
              test_result_id, parameter_name, value, unit, reference_range, status
            ) VALUES ($1, $2, $3, $4, $5, $6)
          `, [
            id,
            labValue.parameter_name,
            labValue.value,
            labValue.unit || null,
            labValue.reference_range || null,
            labValue.status || 'normal'
          ]);
        }
      }
      
      await client.query('COMMIT');
      
      res.json({
        success: true,
        data: result.rows[0],
        message: 'Test result updated successfully'
      });
      
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
    
  } catch (error) {
    console.error('Error updating test result:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to update test result'
    });
  }
});

// Delete test result
router.delete('/:id', authenticateToken, addPatientFilter, async (req, res) => {
  try {
    const { id } = req.params;
    
    // Get PDF file path before deletion
    const filePathResult = await db.query(
      'SELECT pdf_file_path FROM test_results WHERE id = $1',
      [id]
    );
    
    const result = await db.query(
      'DELETE FROM test_results WHERE id = $1 RETURNING test_name, patient_id',
      [id]
    );
    
    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Test result not found'
      });
    }
    
    // Delete PDF file if it exists
    if (filePathResult.rows.length > 0 && filePathResult.rows[0].pdf_file_path) {
      try {
        await fs.unlink(filePathResult.rows[0].pdf_file_path);
      } catch (fileError) {
        console.error('Error deleting PDF file:', fileError);
        // Don't fail the request if file deletion fails
      }
    }
    
    res.json({
      success: true,
      message: `Test result "${result.rows[0].test_name}" deleted successfully`
    });
  } catch (error) {
    console.error('Error deleting test result:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to delete test result'
    });
  }
});

// Get test result statistics
router.get('/stats/summary', async (req, res) => {
  try {
    const result = await db.query(`
      SELECT 
        COUNT(DISTINCT tr.id) as total_reports,
        COUNT(DISTINCT tr.patient_id) as unique_patients,
        COUNT(CASE WHEN tr.created_at >= CURRENT_DATE - INTERVAL '30 days' THEN 1 END) as recent_reports,
        COUNT(CASE WHEN lv.status IN ('high', 'low', 'critical') THEN 1 END) as abnormal_values
      FROM test_results tr
      LEFT JOIN lab_values lv ON tr.id = lv.test_result_id
    `);
    
    res.json({
      success: true,
      data: result.rows[0]
    });
  } catch (error) {
    console.error('Error fetching test result statistics:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch test result statistics'
    });
  }
});

// Download PDF file
router.get('/:id/download', authenticateToken, addPatientFilter, async (req, res) => {
  try {
    const { id } = req.params;
    
    const result = await db.query(`
      SELECT 
        tr.pdf_file_path, 
        tr.test_name, 
        tr.test_date,
        p.first_name,
        p.last_name
      FROM test_results tr
      LEFT JOIN patients p ON tr.patient_id = p.id
      WHERE tr.id = $1
    `, [id]);
    
    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Test result not found'
      });
    }
    
    const { pdf_file_path, test_name, test_date, first_name, last_name } = result.rows[0];
    
    if (!pdf_file_path) {
      return res.status(404).json({
        success: false,
        error: 'PDF file not available for this test result'
      });
    }
    
    // Check if file exists
    try {
      await fs.access(pdf_file_path);
    } catch (error) {
      return res.status(404).json({
        success: false,
        error: 'PDF file not found on server'
      });
    }
    
    // Generate descriptive filename: test_name_date_patient_name.pdf
    const filename = generatePdfFilename(test_name, test_date, first_name, last_name);
    
    // Set appropriate headers
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    
    // Stream the file
    const fileStream = require('fs').createReadStream(pdf_file_path);
    fileStream.pipe(res);
    
  } catch (error) {
    console.error('Error downloading PDF:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to download PDF'
    });
  }
});

// View PDF inline in browser
router.get('/:id/view', authenticateToken, addPatientFilter, async (req, res) => {
  try {
    const { id } = req.params;
    
    // Get test result details
    const result = await db.query(`
      SELECT 
        tr.pdf_file_path, 
        tr.test_name, 
        tr.test_date,
        p.first_name,
        p.last_name
      FROM test_results tr
      LEFT JOIN patients p ON tr.patient_id = p.id
      WHERE tr.id = $1 AND tr.pdf_file_path IS NOT NULL
    `, [id]);
    
    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Test result or PDF file not found'
      });
    }
    
    const { pdf_file_path, test_name, test_date, first_name, last_name } = result.rows[0];
    
    // Check if file exists
    if (!require('fs').existsSync(pdf_file_path)) {
      return res.status(404).json({
        success: false,
        error: 'PDF file not found on server'
      });
    }
    
    // Generate descriptive filename for inline viewing: test_name_date_patient_name.pdf
    const filename = generatePdfFilename(test_name, test_date, first_name, last_name);
    
    // Set headers for inline viewing in browser
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `inline; filename="${filename}"`);
    
    // Stream the file
    const fileStream = require('fs').createReadStream(pdf_file_path);
    fileStream.pipe(res);
    
  } catch (error) {
    console.error('Error viewing PDF:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to view PDF'
    });
  }
});

// Get lab values by test result ID
router.get('/:id/lab-values', authenticateToken, addPatientFilter, async (req, res) => {
  try {
    const { id } = req.params;
    
    const result = await db.query(`
      SELECT lv.*, tr.test_name, tr.test_date
      FROM lab_values lv
      JOIN test_results tr ON lv.test_result_id = tr.id
      WHERE tr.id = $1
      ORDER BY lv.created_at ASC
    `, [id]);
    
    res.json({
      success: true,
      data: result.rows,
      count: result.rows.length
    });
  } catch (error) {
    console.error('Error fetching lab values:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch lab values'
    });
  }
});

module.exports = router;