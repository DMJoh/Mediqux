const express = require('express');
const router = express.Router();
const db = require('../database/db');
const { addPatientFilter, patientFilterClause, patientFilterAllows } = require('../middleware/auth');

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// Get all prescriptions with detailed information (with RBAC filtering)
router.get('/', addPatientFilter, async (req, res) => {
  try {
    const { search, status } = req.query;
    
    let query = `
      SELECT 
        p.id,
        p.appointment_id,
        p.medication_id,
        p.dosage,
        p.frequency,
        p.duration,
        p.instructions,
        p.created_at,
        
        -- Patient information
        pat.id as patient_id,
        pat.first_name as patient_first_name,
        pat.last_name as patient_last_name,
        pat.phone as patient_phone,
        pat.email as patient_email,
        
        -- Medication information
        m.name as medication_name,
        m.generic_name as medication_generic_name,
        m.manufacturer as medication_manufacturer,
        
        -- Appointment information
        a.appointment_date,
        a.type as appointment_type,
        a.status as appointment_status,
        
        -- Doctor information
        d.first_name as doctor_first_name,
        d.last_name as doctor_last_name,
        d.specialty as doctor_specialty,
        
        -- Institution information
        i.name as institution_name,
        
        -- Determine prescription status based on patient_medications
        COALESCE(pm.status, 'active') as status
        
      FROM prescriptions p
      LEFT JOIN appointments a ON p.appointment_id = a.id
      LEFT JOIN patients pat ON a.patient_id = pat.id
      LEFT JOIN medications m ON p.medication_id = m.id
      LEFT JOIN doctors d ON a.doctor_id = d.id
      LEFT JOIN institutions i ON a.institution_id = i.id
      LEFT JOIN patient_medications pm
        ON pm.prescription_id = p.id
        OR (pm.prescription_id IS NULL AND pat.id = pm.patient_id AND m.id = pm.medication_id)
      WHERE 1=1
    `;
    
    if (req.patientFilter === 'none') {
      return res.json({
        success: true,
        data: [],
        count: 0
      });
    }

    const queryParams = [];
    query += ` AND ${patientFilterClause(req.patientFilter, 'pat.id', queryParams)}`;
    let paramIndex = queryParams.length + 1;

    // Add filters if provided
    if (search) {
      query += ` AND (
        pat.first_name ILIKE $${paramIndex} OR 
        pat.last_name ILIKE $${paramIndex} OR 
        m.name ILIKE $${paramIndex} OR 
        m.generic_name ILIKE $${paramIndex} OR
        d.first_name ILIKE $${paramIndex} OR 
        d.last_name ILIKE $${paramIndex}
      )`;
      queryParams.push(`%${search}%`);
      paramIndex++;
    }
    
    if (status) {
      query += ` AND COALESCE(pm.status, 'active') = $${paramIndex}`;
      queryParams.push(status);
      paramIndex++;
    }
    
    query += ` ORDER BY p.created_at DESC`;
    
    const result = await db.query(query, queryParams);
    
    res.json({
      success: true,
      data: result.rows,
      count: result.rows.length
    });
  } catch (error) {
    console.error('Error fetching prescriptions:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch prescriptions'
    });
  }
});

// Get single prescription by ID
router.get('/:id', addPatientFilter, async (req, res) => {
  try {
    const { id } = req.params;
    
    const result = await db.query(`
      SELECT 
        p.*,
        
        -- Patient information
        pat.id as patient_id,
        pat.first_name as patient_first_name,
        pat.last_name as patient_last_name,
        pat.phone as patient_phone,
        pat.email as patient_email,
        
        -- Medication information
        m.name as medication_name,
        m.generic_name as medication_generic_name,
        m.manufacturer as medication_manufacturer,
        m.description as medication_description,
        
        -- Appointment information
        a.appointment_date,
        a.type as appointment_type,
        a.status as appointment_status,
        a.notes as appointment_notes,
        
        -- Doctor information
        d.first_name as doctor_first_name,
        d.last_name as doctor_last_name,
        d.specialty as doctor_specialty,
        
        -- Institution information
        i.name as institution_name,
        
        -- Patient medication status
        COALESCE(pm.status, 'active') as status,
        pm.start_date,
        pm.end_date,
        pm.notes as medication_notes
        
      FROM prescriptions p
      LEFT JOIN appointments a ON p.appointment_id = a.id
      LEFT JOIN patients pat ON a.patient_id = pat.id
      LEFT JOIN medications m ON p.medication_id = m.id
      LEFT JOIN doctors d ON a.doctor_id = d.id
      LEFT JOIN institutions i ON a.institution_id = i.id
      LEFT JOIN patient_medications pm
        ON pm.prescription_id = p.id
        OR (pm.prescription_id IS NULL AND pat.id = pm.patient_id AND m.id = pm.medication_id)
      WHERE p.id = $1
      LIMIT 1
    `, [id]);
    
    if (result.rows.length === 0 || !patientFilterAllows(req.patientFilter, result.rows[0].patient_id)) {
      return res.status(404).json({
        success: false,
        error: 'Prescription not found'
      });
    }

    res.json({
      success: true,
      data: result.rows[0]
    });
  } catch (error) {
    console.error('Error fetching prescription:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch prescription'
    });
  }
});

// Create new prescription
router.post('/', addPatientFilter, async (req, res) => {
  try {
    const {
      appointment_id,
      medication_id,
      dosage,
      frequency,
      duration,
      instructions,
      status = 'active'
    } = req.body;

    // Basic validation
    if (!appointment_id || !medication_id || !dosage || !frequency || !duration) {
      return res.status(400).json({
        success: false,
        error: 'Appointment, medication, dosage, frequency, and duration are required'
      });
    }

    // Verify appointment exists
    const appointmentCheck = await db.query(
      'SELECT id, patient_id FROM appointments WHERE id = $1',
      [appointment_id]
    );

    if (appointmentCheck.rows.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'Appointment not found'
      });
    }

    if (!patientFilterAllows(req.patientFilter, appointmentCheck.rows[0].patient_id)) {
      return res.status(403).json({
        success: false,
        error: 'Access denied'
      });
    }

    // Verify medication exists
    const medicationCheck = await db.query(
      'SELECT id, name FROM medications WHERE id = $1',
      [medication_id]
    );
    
    if (medicationCheck.rows.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'Medication not found'
      });
    }
    
    const client = await db.getClient();
    
    try {
      await client.query('BEGIN');
      
      // Create prescription
      const prescriptionResult = await client.query(`
        INSERT INTO prescriptions (
          appointment_id, medication_id, dosage, frequency, duration, instructions
        ) VALUES ($1, $2, $3, $4, $5, $6)
        RETURNING *
      `, [appointment_id, medication_id, dosage, frequency, duration, instructions || null]);
      
      const prescription = prescriptionResult.rows[0];
      const patientId = appointmentCheck.rows[0].patient_id;

      // Every new prescription gets its own patient_medications status row,
      // linked by prescription_id — this is what lets two separate
      // prescriptions of the same medication for the same patient carry
      // independent statuses instead of colliding on one shared row.
      await client.query(`
        INSERT INTO patient_medications (
          patient_id, medication_id, prescription_id, status, start_date, notes
        ) VALUES ($1, $2, $3, $4, CURRENT_DATE, $5)
      `, [patientId, medication_id, prescription.id, status, `${dosage}, ${frequency}, ${duration}${instructions ? ' - ' + instructions : ''}`]);

      await client.query('COMMIT');
      
      res.status(201).json({
        success: true,
        data: prescription,
        message: 'Prescription created successfully'
      });
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  } catch (error) {
    console.error('Error creating prescription:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to create prescription'
    });
  }
});

// Update prescription
router.put('/:id', addPatientFilter, async (req, res) => {
  try {
    const { id } = req.params;
    const {
      appointment_id,
      medication_id,
      dosage,
      frequency,
      duration,
      instructions,
      status = 'active'
    } = req.body;

    // Basic validation
    if (!appointment_id || !medication_id || !dosage || !frequency || !duration) {
      return res.status(400).json({
        success: false,
        error: 'Appointment, medication, dosage, frequency, and duration are required'
      });
    }

    if (req.patientFilter === 'none') {
      return res.status(403).json({ success: false, error: 'Access denied' });
    }

    const existing = await db.query(
      `SELECT a.patient_id FROM prescriptions pr
       JOIN appointments a ON pr.appointment_id = a.id
       WHERE pr.id = $1`,
      [id]
    );
    if (existing.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Prescription not found'
      });
    }

    if (!patientFilterAllows(req.patientFilter, existing.rows[0].patient_id)) {
      return res.status(403).json({ success: false, error: 'Access denied' });
    }

    const result = await db.query(`
      UPDATE prescriptions SET
        appointment_id = $1,
        medication_id = $2,
        dosage = $3,
        frequency = $4,
        duration = $5,
        instructions = $6
      WHERE id = $7
      RETURNING *
    `, [appointment_id, medication_id, dosage, frequency, duration, instructions || null, id]);
    
    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Prescription not found'
      });
    }
    
    // Also update patient_medications status to match. Previously this only
    // ran when status !== 'active', so reverting a prescription back to
    // Active from Discontinued/Completed silently left the old status in
    // place (GET only defaults to 'active' via COALESCE when the column is
    // NULL, not when it holds an explicit non-active value).
    //
    // Three-step upsert, in order, run inside a transaction to close the
    // TOCTOU race a plain sequence of db.query calls would have (two
    // concurrent edits of the same prescription could otherwise both find
    // "no own row" and both try to claim/insert):
    //  1. This prescription already owns a dedicated patient_medications row
    //     (prescription_id = id) — just update it.
    //  2. It doesn't yet, but a legacy row exists for this (patient,
    //     medication) pair with no owning prescription (prescription_id IS
    //     NULL — either pre-dates this column, or was shared with a sibling
    //     prescription of the same medication under the old collapsed-status
    //     behavior). Lock it with FOR UPDATE before claiming, so a second
    //     concurrent request can't claim the same legacy row twice.
    //  3. Neither exists (e.g. seed data with no patient_medications row at
    //     all) — insert one, with ON CONFLICT (prescription_id) as a last
    //     line of defense against two concurrent requests for the exact same
    //     prescription both reaching this branch (the unique partial index
    //     on prescription_id makes that conflict detectable).
    const appointmentResult = await db.query('SELECT patient_id FROM appointments WHERE id = $1', [appointment_id]);
    if (appointmentResult.rows.length > 0) {
      const patientId = appointmentResult.rows[0].patient_id;
      const client = await db.getClient();

      try {
        await client.query('BEGIN');

        const ownRow = await client.query(`
          UPDATE patient_medications SET
            medication_id = $1,
            status = $2,
            updated_at = CURRENT_TIMESTAMP
          WHERE prescription_id = $3
          RETURNING id
        `, [medication_id, status, id]);

        if (ownRow.rows.length === 0) {
          const candidate = await client.query(`
            SELECT id FROM patient_medications
            WHERE patient_id = $1 AND medication_id = $2 AND prescription_id IS NULL
            ORDER BY created_at
            LIMIT 1
            FOR UPDATE
          `, [patientId, medication_id]);

          if (candidate.rows.length > 0) {
            await client.query(`
              UPDATE patient_medications SET
                prescription_id = $1,
                status = $2,
                updated_at = CURRENT_TIMESTAMP
              WHERE id = $3
            `, [id, status, candidate.rows[0].id]);
          } else {
            await client.query(`
              INSERT INTO patient_medications (patient_id, medication_id, prescription_id, status, start_date)
              VALUES ($1, $2, $3, $4, CURRENT_DATE)
              ON CONFLICT (prescription_id) DO UPDATE SET
                medication_id = EXCLUDED.medication_id,
                status = EXCLUDED.status,
                updated_at = CURRENT_TIMESTAMP
            `, [patientId, medication_id, id, status]);
          }
        }

        await client.query('COMMIT');
      } catch (error) {
        await client.query('ROLLBACK');
        throw error;
      } finally {
        client.release();
      }
    }
    
    res.json({
      success: true,
      data: result.rows[0],
      message: 'Prescription updated successfully'
    });
  } catch (error) {
    console.error('Error updating prescription:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to update prescription'
    });
  }
});

// Delete prescription
router.delete('/:id', addPatientFilter, async (req, res) => {
  try {
    const { id } = req.params;

    if (req.patientFilter === 'none') {
      return res.status(403).json({ success: false, error: 'Access denied' });
    }

    const existing = await db.query(
      `SELECT a.patient_id FROM prescriptions pr
       JOIN appointments a ON pr.appointment_id = a.id
       WHERE pr.id = $1`,
      [id]
    );
    if (existing.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Prescription not found'
      });
    }

    if (!patientFilterAllows(req.patientFilter, existing.rows[0].patient_id)) {
      return res.status(403).json({ success: false, error: 'Access denied' });
    }

    const result = await db.query(`
      DELETE FROM prescriptions WHERE id = $1
      RETURNING appointment_id, medication_id
    `, [id]);

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Prescription not found'
      });
    }
    
    res.json({
      success: true,
      message: 'Prescription deleted successfully'
    });
  } catch (error) {
    console.error('Error deleting prescription:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to delete prescription'
    });
  }
});

// Get prescription statistics
router.get('/stats/summary', addPatientFilter, async (req, res) => {
  try {
    if (req.patientFilter === 'none') {
      return res.json({ success: true, data: { total_prescriptions: 0, active_prescriptions: 0, unique_patients: 0, recent_prescriptions: 0 } });
    }

    const queryParams = [];
    const whereClause = `WHERE ${patientFilterClause(req.patientFilter, 'a.patient_id', queryParams)}`;

    const result = await db.query(`
      SELECT
        COUNT(*) as total_prescriptions,
        COUNT(CASE WHEN COALESCE(pm.status, 'active') = 'active' THEN 1 END) as active_prescriptions,
        COUNT(DISTINCT a.patient_id) as unique_patients,
        COUNT(CASE WHEN p.created_at >= CURRENT_DATE - INTERVAL '30 days' THEN 1 END) as recent_prescriptions
      FROM prescriptions p
      LEFT JOIN appointments a ON p.appointment_id = a.id
      LEFT JOIN patient_medications pm
        ON pm.prescription_id = p.id
        OR (pm.prescription_id IS NULL AND a.patient_id = pm.patient_id AND p.medication_id = pm.medication_id)
      ${whereClause}
    `, queryParams);

    res.json({
      success: true,
      data: result.rows[0]
    });
  } catch (error) {
    console.error('Error fetching prescription statistics:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch prescription statistics'
    });
  }
});

// Get prescriptions by patient
router.get('/patient/:patient_id', addPatientFilter, async (req, res) => {
  try {
    const { patient_id } = req.params;
    const { status } = req.query;

    if (!UUID_RE.test(patient_id)) {
      return res.status(400).json({ success: false, error: 'Invalid patient ID' });
    }

    if (req.patientFilter === 'none') {
      return res.json({ success: true, data: [], count: 0 });
    }

    if (!patientFilterAllows(req.patientFilter, patient_id)) {
      return res.status(403).json({ success: false, error: 'Access denied' });
    }

    let query = `
      SELECT
        p.*,
        m.name as medication_name,
        m.generic_name as medication_generic_name,
        a.appointment_date,
        d.first_name as doctor_first_name,
        d.last_name as doctor_last_name,
        i.name as institution_name,
        COALESCE(pm.status, 'active') as current_status,
        pm.start_date,
        pm.end_date,
        pm.notes as medication_notes
      FROM prescriptions p
      LEFT JOIN appointments a ON p.appointment_id = a.id
      LEFT JOIN medications m ON p.medication_id = m.id
      LEFT JOIN doctors d ON a.doctor_id = d.id
      LEFT JOIN institutions i ON a.institution_id = i.id
      LEFT JOIN patient_medications pm
        ON pm.prescription_id = p.id
        OR (pm.prescription_id IS NULL AND a.patient_id = pm.patient_id AND m.id = pm.medication_id)
      WHERE a.patient_id = $1
    `;

    const queryParams = [patient_id];
    let paramIndex = 2;
    
    if (status) {
      query += ` AND COALESCE(pm.status, 'active') = $${paramIndex}`;
      queryParams.push(status);
      paramIndex++;
    }
    
    query += ` ORDER BY p.created_at DESC`;
    
    const result = await db.query(query, queryParams);
    
    res.json({
      success: true,
      data: result.rows,
      count: result.rows.length
    });
  } catch (error) {
    console.error('Error fetching patient prescriptions:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch patient prescriptions'
    });
  }
});

// Get prescriptions by appointment
router.get('/appointment/:appointment_id', addPatientFilter, async (req, res) => {
  try {
    const { appointment_id } = req.params;

    if (!UUID_RE.test(appointment_id)) {
      return res.status(400).json({ success: false, error: 'Invalid appointment ID' });
    }

    if (req.patientFilter === 'none') {
      return res.json({ success: true, data: [], count: 0 });
    }

    const queryParams = [appointment_id];
    const patientWhere = ` AND ${patientFilterClause(req.patientFilter, 'a.patient_id', queryParams)}`;

    const result = await db.query(`
      SELECT
        p.*,
        m.name as medication_name,
        m.generic_name as medication_generic_name,
        m.description as medication_description,
        COALESCE(pm.status, 'active') as current_status
      FROM prescriptions p
      LEFT JOIN medications m ON p.medication_id = m.id
      LEFT JOIN appointments a ON p.appointment_id = a.id
      LEFT JOIN patient_medications pm
        ON pm.prescription_id = p.id
        OR (pm.prescription_id IS NULL AND a.patient_id = pm.patient_id AND m.id = pm.medication_id)
      WHERE p.appointment_id = $1${patientWhere}
      ORDER BY p.created_at DESC
    `, queryParams);
    
    res.json({
      success: true,
      data: result.rows,
      count: result.rows.length
    });
  } catch (error) {
    console.error('Error fetching appointment prescriptions:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch appointment prescriptions'
    });
  }
});

module.exports = router;