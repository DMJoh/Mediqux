const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs').promises;
const fsSync = require('fs');
const router = express.Router();
const db = require('../database/db');
const { addPatientFilter } = require('../middleware/auth');

// --- File upload setup ---
const storage = multer.diskStorage({
  destination: async (req, file, cb) => {
    const uploadsDir = path.join(__dirname, '../../uploads/diagnostic-studies');
    try {
      await fs.mkdir(uploadsDir, { recursive: true });
      cb(null, uploadsDir);
    } catch (error) {
      cb(error);
    }
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
    cb(null, `study-${uniqueSuffix}${path.extname(file.originalname)}`);
  }
});

const upload = multer({
  storage,
  limits: { fileSize: 20 * 1024 * 1024 }, // 20MB
  fileFilter: (req, file, cb) => {
    const allowed = ['application/pdf', 'image/jpeg', 'image/png', 'image/webp'];
    if (allowed.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Only PDF and image files (JPG, PNG, WEBP) are allowed'));
    }
  }
});

// --- GET /stats/summary ---
router.get('/stats/summary', addPatientFilter, async (req, res) => {
  try {
    if (req.patientFilter === 'none') {
      return res.json({ success: true, data: { total_studies: 0, this_month: 0, unique_patients: 0 } });
    }

    let whereClause = '';
    const params = [];
    if (req.patientFilter) {
      whereClause = 'WHERE patient_id = $1';
      params.push(req.patientFilter);
    }

    const result = await db.query(`
      SELECT
        COUNT(*) AS total_studies,
        COUNT(*) FILTER (WHERE study_date >= date_trunc('month', CURRENT_DATE)) AS this_month,
        COUNT(DISTINCT patient_id) AS unique_patients
      FROM diagnostic_studies
      ${whereClause}
    `, params);

    res.json({ success: true, data: result.rows[0] });
  } catch (error) {
    console.error('Error fetching diagnostic studies stats:', error);
    res.status(500).json({ success: false, message: 'Error fetching stats' });
  }
});

// --- GET / (list all) ---
router.get('/', addPatientFilter, async (req, res) => {
  try {
    if (req.patientFilter === 'none') {
      return res.json({ success: true, data: [] });
    }

    const params = [];
    let patientWhere = '';
    if (req.patientFilter) {
      patientWhere = 'AND ds.patient_id = $1';
      params.push(req.patientFilter);
    }

    const { search, study_type, patient_id } = req.query;
    let extraWhere = '';

    if (search) {
      params.push(`%${search}%`);
      extraWhere += ` AND (ds.study_type ILIKE $${params.length} OR ds.body_region ILIKE $${params.length} OR ds.findings ILIKE $${params.length} OR ds.conclusion ILIKE $${params.length})`;
    }

    if (study_type) {
      params.push(study_type);
      extraWhere += ` AND ds.study_type = $${params.length}`;
    }

    // Admin can filter by specific patient
    if (patient_id && !req.patientFilter) {
      params.push(patient_id);
      extraWhere += ` AND ds.patient_id = $${params.length}`;
    }

    const result = await db.query(`
      SELECT
        ds.id,
        ds.study_type,
        ds.body_region,
        ds.study_date,
        ds.clinical_indication,
        ds.findings,
        ds.conclusion,
        ds.attachment_path,
        ds.attachment_original_name,
        ds.attachment_mime_type,
        ds.notes,
        ds.created_at,
        p.id AS patient_id,
        p.first_name AS patient_first_name,
        p.last_name AS patient_last_name,
        CASE WHEN op.id IS NOT NULL THEN json_build_object('id', op.id, 'first_name', op.first_name, 'last_name', op.last_name, 'specialty', op.specialty) ELSE NULL END AS ordering_physician,
        CASE WHEN pp.id IS NOT NULL THEN json_build_object('id', pp.id, 'first_name', pp.first_name, 'last_name', pp.last_name, 'specialty', pp.specialty) ELSE NULL END AS performing_physician,
        CASE WHEN i.id IS NOT NULL THEN json_build_object('id', i.id, 'name', i.name) ELSE NULL END AS institution
      FROM diagnostic_studies ds
      JOIN patients p ON ds.patient_id = p.id
      LEFT JOIN doctors op ON ds.ordering_physician_id = op.id
      LEFT JOIN doctors pp ON ds.performing_physician_id = pp.id
      LEFT JOIN institutions i ON ds.institution_id = i.id
      WHERE 1=1 ${patientWhere} ${extraWhere}
      ORDER BY ds.study_date DESC, ds.created_at DESC
    `, params);

    res.json({ success: true, data: result.rows });
  } catch (error) {
    console.error('Error fetching diagnostic studies:', error);
    res.status(500).json({ success: false, message: 'Error fetching diagnostic studies' });
  }
});

// --- GET /:id ---
router.get('/:id', addPatientFilter, async (req, res) => {
  try {
    if (req.patientFilter === 'none') {
      return res.status(403).json({ success: false, message: 'Access denied' });
    }

    const params = [req.params.id];
    let patientWhere = '';
    if (req.patientFilter) {
      patientWhere = 'AND ds.patient_id = $2';
      params.push(req.patientFilter);
    }

    const result = await db.query(`
      SELECT
        ds.*,
        p.first_name AS patient_first_name,
        p.last_name AS patient_last_name,
        CASE WHEN op.id IS NOT NULL THEN json_build_object('id', op.id, 'first_name', op.first_name, 'last_name', op.last_name, 'specialty', op.specialty) ELSE NULL END AS ordering_physician,
        CASE WHEN pp.id IS NOT NULL THEN json_build_object('id', pp.id, 'first_name', pp.first_name, 'last_name', pp.last_name, 'specialty', pp.specialty) ELSE NULL END AS performing_physician,
        CASE WHEN i.id IS NOT NULL THEN json_build_object('id', i.id, 'name', i.name) ELSE NULL END AS institution
      FROM diagnostic_studies ds
      JOIN patients p ON ds.patient_id = p.id
      LEFT JOIN doctors op ON ds.ordering_physician_id = op.id
      LEFT JOIN doctors pp ON ds.performing_physician_id = pp.id
      LEFT JOIN institutions i ON ds.institution_id = i.id
      WHERE ds.id = $1 ${patientWhere}
    `, params);

    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Study not found' });
    }

    res.json({ success: true, data: result.rows[0] });
  } catch (error) {
    console.error('Error fetching diagnostic study:', error);
    res.status(500).json({ success: false, message: 'Error fetching study' });
  }
});

// --- POST / (create with optional file upload) ---
router.post('/', upload.single('attachment'), addPatientFilter, async (req, res) => {
  try {
    const {
      patient_id, study_type, body_region, study_date,
      ordering_physician_id, performing_physician_id, institution_id,
      clinical_indication, findings, conclusion, notes
    } = req.body;

    if (!patient_id || !study_type || !study_date) {
      return res.status(400).json({ success: false, message: 'patient_id, study_type and study_date are required' });
    }

    // Non-admin users can only create studies for their own patient
    if (req.patientFilter === 'none') {
      return res.status(403).json({ success: false, message: 'Access denied' });
    }
    if (req.patientFilter && req.patientFilter !== patient_id) {
      return res.status(403).json({ success: false, message: 'Access denied' });
    }

    let attachment_path = null;
    let attachment_original_name = null;
    let attachment_mime_type = null;

    if (req.file) {
      attachment_path = req.file.path;
      attachment_original_name = req.file.originalname;
      attachment_mime_type = req.file.mimetype;
    }

    const result = await db.query(`
      INSERT INTO diagnostic_studies
        (patient_id, study_type, body_region, study_date,
         ordering_physician_id, performing_physician_id, institution_id,
         clinical_indication, findings, conclusion,
         attachment_path, attachment_original_name, attachment_mime_type, notes)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14)
      RETURNING *
    `, [
      patient_id, study_type, body_region || null, study_date,
      ordering_physician_id || null, performing_physician_id || null, institution_id || null,
      clinical_indication || null, findings || null, conclusion || null,
      attachment_path, attachment_original_name, attachment_mime_type,
      notes || null
    ]);

    res.status(201).json({ success: true, data: result.rows[0] });
  } catch (error) {
    console.error('Error creating diagnostic study:', error);
    res.status(500).json({ success: false, message: 'Error creating diagnostic study' });
  }
});

// --- PUT /:id ---
router.put('/:id', upload.single('attachment'), addPatientFilter, async (req, res) => {
  try {
    const {
      patient_id, study_type, body_region, study_date,
      ordering_physician_id, performing_physician_id, institution_id,
      clinical_indication, findings, conclusion, notes
    } = req.body;

    if (req.patientFilter === 'none') {
      return res.status(403).json({ success: false, message: 'Access denied' });
    }

    // Fetch existing to handle file replacement and ownership check
    const existing = await db.query('SELECT * FROM diagnostic_studies WHERE id = $1', [req.params.id]);
    if (existing.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Study not found' });
    }

    // Non-admin: can only edit their own patient's study
    if (req.patientFilter && existing.rows[0].patient_id !== req.patientFilter) {
      return res.status(403).json({ success: false, message: 'Access denied' });
    }

    let attachment_path = existing.rows[0].attachment_path;
    let attachment_original_name = existing.rows[0].attachment_original_name;
    let attachment_mime_type = existing.rows[0].attachment_mime_type;

    if (req.file) {
      // Delete old file if exists
      if (attachment_path) {
        try {
          const uploadsDir = path.resolve('./uploads');
          const filePath = path.resolve(attachment_path);
          if (filePath.startsWith(uploadsDir + path.sep)) {
            await fs.unlink(filePath);
          }
        } catch (error_) {
          logger.warn('Failed to delete old attachment file', { error: error_.message, path: attachment_path });
        }
      }
      attachment_path = req.file.path;
      attachment_original_name = req.file.originalname;
      attachment_mime_type = req.file.mimetype;
    }

    const result = await db.query(`
      UPDATE diagnostic_studies SET
        patient_id = $1, study_type = $2, body_region = $3, study_date = $4,
        ordering_physician_id = $5, performing_physician_id = $6, institution_id = $7,
        clinical_indication = $8, findings = $9, conclusion = $10,
        attachment_path = $11, attachment_original_name = $12, attachment_mime_type = $13,
        notes = $14
      WHERE id = $15
      RETURNING *
    `, [
      patient_id, study_type, body_region || null, study_date,
      ordering_physician_id || null, performing_physician_id || null, institution_id || null,
      clinical_indication || null, findings || null, conclusion || null,
      attachment_path, attachment_original_name, attachment_mime_type,
      notes || null, req.params.id
    ]);

    res.json({ success: true, data: result.rows[0] });
  } catch (error) {
    console.error('Error updating diagnostic study:', error);
    res.status(500).json({ success: false, message: 'Error updating study' });
  }
});

// --- DELETE /:id ---
router.delete('/:id', addPatientFilter, async (req, res) => {
  try {
    if (req.patientFilter === 'none') {
      return res.status(403).json({ success: false, message: 'Access denied' });
    }

    const existing = await db.query('SELECT attachment_path, patient_id FROM diagnostic_studies WHERE id = $1', [req.params.id]);
    if (existing.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Study not found' });
    }

    // Non-admin: can only delete their own patient's study
    if (req.patientFilter && existing.rows[0].patient_id !== req.patientFilter) {
      return res.status(403).json({ success: false, message: 'Access denied' });
    }

    // Delete attachment file if exists
    if (existing.rows[0].attachment_path) {
      try {
        const uploadsDir = path.resolve('./uploads');
        const filePath = path.resolve(existing.rows[0].attachment_path);
        if (filePath.startsWith(uploadsDir + path.sep)) {
          await fs.unlink(filePath);
        }
      } catch (error_) {
        logger.warn('Failed to delete attachment file', { error: error_.message, path: existing.rows[0].attachment_path });
      }
    }

    await db.query('DELETE FROM diagnostic_studies WHERE id = $1', [req.params.id]);
    res.json({ success: true, message: 'Study deleted successfully' });
  } catch (error) {
    console.error('Error deleting diagnostic study:', error);
    res.status(500).json({ success: false, message: 'Error deleting study' });
  }
});

router.get('/:id/view', addPatientFilter, async (req, res) => {
  try {
    const { id } = req.params;

    const result = await db.query(`
      SELECT
        ds.attachment_path,
        ds.attachment_mime_type,
        ds.attachment_original_name,
        ds.study_type,
        ds.study_date,
        p.first_name,
        p.last_name
      FROM diagnostic_studies ds
      LEFT JOIN patients p ON ds.patient_id = p.id
      WHERE ds.id = $1 AND ds.attachment_path IS NOT NULL
    `, [id]);

    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Study or attachment not found' });
    }

    const { attachment_path, attachment_mime_type, attachment_original_name, study_type, study_date, first_name, last_name } = result.rows[0];

    if (!fsSync.existsSync(attachment_path)) {
      return res.status(404).json({ success: false, error: 'Attachment file not found on server' });
    }

    const date = study_date ? new Date(study_date).toISOString().slice(0, 10) : 'unknown';
    const patient = `${first_name}_${last_name}`.replace(/\s+/g, '_');
    const ext = path.extname(attachment_original_name || '.pdf');
    const filename = `${study_type}_${date}_${patient}${ext}`.replace(/[^a-zA-Z0-9._-]/g, '_');

    res.setHeader('Content-Type', attachment_mime_type || 'application/octet-stream');
    res.setHeader('Content-Disposition', `inline; filename="${filename}"`);

    fsSync.createReadStream(attachment_path).pipe(res);

  } catch (error) {
    console.error('Error viewing study attachment:', error);
    res.status(500).json({ success: false, error: 'Failed to view attachment' });
  }
});

module.exports = router;
