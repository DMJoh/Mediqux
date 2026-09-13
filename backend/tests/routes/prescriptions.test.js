const request = require('supertest');
const createApp = require('../helpers/createApp');

jest.mock('../../src/database/db', () => ({ query: jest.fn(), getClient: jest.fn() }));
jest.mock('../../src/middleware/auth', () => {
  const actual = jest.requireActual('../../src/middleware/auth');
  return {
    ...actual,
    addPatientFilter: (req, res, next) => next(),
    authenticateToken: (req, res, next) => next(),
    requireAdmin: (req, res, next) => next(),
  };
});

const db = require('../../src/database/db');
const prescriptionsRouter = require('../../src/routes/prescriptions');

const PATIENT_UUID = '00000000-0000-0000-0000-000000000005';
const OTHER_UUID   = '00000000-0000-0000-0000-000000000099';
const APPT_UUID    = '00000000-0000-0000-0000-000000000001';

const adminApp    = createApp(prescriptionsRouter, { role: 'admin' });
const noneApp     = createApp(prescriptionsRouter, { role: 'user', patientId: null });
const filteredApp = createApp(prescriptionsRouter, { role: 'user', patientId: PATIENT_UUID });

let mockClient;
beforeEach(() => {
  db.query.mockReset();
  mockClient = { query: jest.fn(), release: jest.fn() };
  db.getClient.mockResolvedValue(mockClient);
});

// ─── GET / ────────────────────────────────────────────────────────────────

describe('GET /prescriptions', () => {
  it('admin: returns all prescriptions', async () => {
    db.query.mockResolvedValueOnce({ rows: [{ id: 1 }], rowCount: 1 });
    const res = await request(adminApp).get('/');
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });

  it('user with no patient access returns empty array', async () => {
    const res = await request(noneApp).get('/');
    expect(res.status).toBe(200);
    expect(res.body.data).toEqual([]);
    expect(res.body.count).toBe(0);
  });

  it('user with patientId sees filtered prescriptions', async () => {
    db.query.mockResolvedValueOnce({ rows: [{ id: 1 }], rowCount: 1 });
    const res = await request(filteredApp).get('/');
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });

  it('supports search query parameter', async () => {
    db.query.mockResolvedValueOnce({ rows: [], rowCount: 0 });
    const res = await request(adminApp).get('/').query({ search: 'aspirin' });
    expect(res.status).toBe(200);
  });

  it('supports status filter', async () => {
    db.query.mockResolvedValueOnce({ rows: [], rowCount: 0 });
    const res = await request(adminApp).get('/').query({ status: 'active' });
    expect(res.status).toBe(200);
  });

  it('returns 500 when DB throws', async () => {
    db.query.mockRejectedValue(new Error('DB error'));
    const res = await request(adminApp).get('/');
    expect(res.status).toBe(500);
  });
});

// ─── GET /stats/summary ───────────────────────────────────────────────────

describe('GET /prescriptions/stats/summary', () => {
  it('returns empty stats when patientFilter is "none"', async () => {
    const res = await request(noneApp).get('/stats/summary');
    expect(res.status).toBe(200);
    expect(res.body.data.total_prescriptions).toBe(0);
  });

  it('returns stats for admin', async () => {
    db.query.mockResolvedValueOnce({ rows: [{ total_prescriptions: 5, active_prescriptions: 3 }] });
    const res = await request(adminApp).get('/stats/summary');
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });

  it('returns filtered stats for user with patientId', async () => {
    db.query.mockResolvedValueOnce({ rows: [{ total_prescriptions: 2, active_prescriptions: 2, unique_patients: 1, recent_prescriptions: 0 }] });
    const res = await request(filteredApp).get('/stats/summary');
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });

  it('returns 500 when DB throws', async () => {
    db.query.mockRejectedValue(new Error('DB error'));
    const res = await request(adminApp).get('/stats/summary');
    expect(res.status).toBe(500);
  });
});

// ─── GET /:id ─────────────────────────────────────────────────────────────

describe('GET /prescriptions/:id', () => {
  it('returns 200 with prescription data', async () => {
    db.query.mockResolvedValueOnce({ rows: [{ id: 1, medication_name: 'Aspirin' }] });
    const res = await request(adminApp).get('/1');
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });

  it('returns 404 when not found', async () => {
    db.query.mockResolvedValueOnce({ rows: [] });
    const res = await request(adminApp).get('/999');
    expect(res.status).toBe(404);
  });

  it('returns 500 when DB throws', async () => {
    db.query.mockRejectedValue(new Error('DB error'));
    const res = await request(adminApp).get('/1');
    expect(res.status).toBe(500);
  });
});

// ─── POST / ───────────────────────────────────────────────────────────────

describe('POST /prescriptions', () => {
  const validPrescription = {
    appointment_id: 1, medication_id: 2,
    dosage: '500mg', frequency: 'twice daily', duration: '7 days',
  };

  it('returns 400 when required fields are missing', async () => {
    const res = await request(adminApp).post('/').send({ appointment_id: 1, medication_id: 2, dosage: '500mg' });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/required/i);
  });

  it('returns 400 when appointment not found', async () => {
    db.query.mockResolvedValueOnce({ rows: [] }); // appointment not found
    const res = await request(adminApp).post('/').send(validPrescription);
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/appointment not found/i);
  });

  it('returns 400 when medication not found', async () => {
    db.query
      .mockResolvedValueOnce({ rows: [{ id: 1, patient_id: 5 }] }) // appointment found
      .mockResolvedValueOnce({ rows: [] });                          // medication not found
    const res = await request(adminApp).post('/').send(validPrescription);
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/medication not found/i);
  });

  it('returns 201 on successful creation and inserts a dedicated patient_medications row', async () => {
    db.query
      .mockResolvedValueOnce({ rows: [{ id: 1, patient_id: 5 }] })    // appointment check
      .mockResolvedValueOnce({ rows: [{ id: 2, name: 'Aspirin' }] }); // medication check
    mockClient.query
      .mockResolvedValueOnce({ rows: [] })                              // BEGIN
      .mockResolvedValueOnce({ rows: [{ id: 5, ...validPrescription }] }) // INSERT prescription
      .mockResolvedValueOnce({ rows: [] })                              // INSERT patient_medications (linked by prescription_id)
      .mockResolvedValueOnce({ rows: [] });                             // COMMIT
    const res = await request(adminApp).post('/').send(validPrescription);
    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(mockClient.query).toHaveBeenCalledWith(
      expect.stringContaining('INSERT INTO patient_medications'),
      expect.arrayContaining([5, validPrescription.medication_id, 5])
    );
    expect(mockClient.release).toHaveBeenCalled();
  });

  it('returns 500 and rolls back when transaction fails', async () => {
    db.query
      .mockResolvedValueOnce({ rows: [{ id: 1, patient_id: 5 }] })
      .mockResolvedValueOnce({ rows: [{ id: 2, name: 'Aspirin' }] });
    mockClient.query
      .mockResolvedValueOnce({ rows: [] })                 // BEGIN
      .mockRejectedValueOnce(new Error('Insert failed')); // INSERT throws
    const res = await request(adminApp).post('/').send(validPrescription);
    expect(res.status).toBe(500);
    expect(mockClient.release).toHaveBeenCalled();
  });

  it('returns 500 when getClient itself throws', async () => {
    db.query
      .mockResolvedValueOnce({ rows: [{ id: 1, patient_id: 5 }] })
      .mockResolvedValueOnce({ rows: [{ id: 2, name: 'Aspirin' }] });
    db.getClient.mockRejectedValue(new Error('Connection pool exhausted'));
    const res = await request(adminApp).post('/').send(validPrescription);
    expect(res.status).toBe(500);
  });

  it('returns 500 when first DB query throws', async () => {
    db.query.mockRejectedValue(new Error('DB error'));
    const res = await request(adminApp).post('/').send(validPrescription);
    expect(res.status).toBe(500);
  });
});

// ─── PUT /:id ─────────────────────────────────────────────────────────────

describe('PUT /prescriptions/:id', () => {
  const validUpdate = {
    appointment_id: 1, medication_id: 2,
    dosage: '1000mg', frequency: 'once daily', duration: '5 days',
  };

  it('returns 400 when required fields are missing', async () => {
    const res = await request(adminApp).put('/1').send({ dosage: '1000mg' });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/required/i);
  });

  it('returns 404 when not found', async () => {
    db.query.mockResolvedValueOnce({ rows: [] }); // ownership check (SELECT existing) → not found
    const res = await request(adminApp).put('/999').send(validUpdate);
    expect(res.status).toBe(404);
  });

  it('returns 200 on successful update', async () => {
    db.query
      .mockResolvedValueOnce({ rows: [{ patient_id: 5 }] })         // ownership check
      .mockResolvedValueOnce({ rows: [{ id: 1, ...validUpdate }] }) // UPDATE prescription
      .mockResolvedValueOnce({ rows: [{ patient_id: 5 }] });        // get appointment
    mockClient.query
      .mockResolvedValueOnce({ rows: [] })    // BEGIN
      .mockResolvedValueOnce({ rows: [{ id: 9 }] }) // own patient_medications row found and updated
      .mockResolvedValueOnce({ rows: [] });   // COMMIT
    const res = await request(adminApp).put('/1').send(validUpdate);
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(mockClient.release).toHaveBeenCalled();
  });

  it('reverting status to active still updates its own patient_medications row (not skipped)', async () => {
    db.query
      .mockResolvedValueOnce({ rows: [{ patient_id: 5 }] })
      .mockResolvedValueOnce({ rows: [{ id: 1, ...validUpdate }] })
      .mockResolvedValueOnce({ rows: [{ patient_id: 5 }] });
    mockClient.query
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [{ id: 9 }] })
      .mockResolvedValueOnce({ rows: [] });
    const res = await request(adminApp).put('/1').send({ ...validUpdate, status: 'active' });
    expect(res.status).toBe(200);
    expect(mockClient.query).toHaveBeenCalledWith(
      expect.stringContaining('WHERE prescription_id = $3'),
      expect.arrayContaining([validUpdate.medication_id, 'active', '1'])
    );
  });

  it('claims an unclaimed legacy patient_medications row when this prescription has none of its own', async () => {
    db.query
      .mockResolvedValueOnce({ rows: [{ patient_id: 5 }] })
      .mockResolvedValueOnce({ rows: [{ id: 1, ...validUpdate }] })
      .mockResolvedValueOnce({ rows: [{ patient_id: 5 }] });
    mockClient.query
      .mockResolvedValueOnce({ rows: [] })          // BEGIN
      .mockResolvedValueOnce({ rows: [] })          // no own row yet
      .mockResolvedValueOnce({ rows: [{ id: 9 }] }) // legacy candidate locked via FOR UPDATE
      .mockResolvedValueOnce({ rows: [] })          // UPDATE (claim)
      .mockResolvedValueOnce({ rows: [] });         // COMMIT
    const res = await request(adminApp).put('/1').send({ ...validUpdate, status: 'completed' });
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(mockClient.query).toHaveBeenCalledWith(
      expect.stringContaining('prescription_id IS NULL'),
      expect.arrayContaining([5, validUpdate.medication_id])
    );
  });

  it('inserts a new patient_medications row when neither an own row nor a legacy row exists (e.g. seeded prescriptions)', async () => {
    db.query
      .mockResolvedValueOnce({ rows: [{ patient_id: 5 }] })
      .mockResolvedValueOnce({ rows: [{ id: 1, ...validUpdate }] })
      .mockResolvedValueOnce({ rows: [{ patient_id: 5 }] });
    mockClient.query
      .mockResolvedValueOnce({ rows: [] }) // BEGIN
      .mockResolvedValueOnce({ rows: [] }) // no own row
      .mockResolvedValueOnce({ rows: [] }) // no unclaimed legacy row
      .mockResolvedValueOnce({ rows: [] }) // INSERT ... ON CONFLICT
      .mockResolvedValueOnce({ rows: [] }); // COMMIT
    const res = await request(adminApp).put('/1').send({ ...validUpdate, status: 'discontinued' });
    expect(res.status).toBe(200);
    expect(mockClient.query).toHaveBeenCalledWith(
      expect.stringContaining('INSERT INTO patient_medications'),
      expect.arrayContaining([5, validUpdate.medication_id, '1', 'discontinued'])
    );
  });

  it('returns 500 and rolls back the patient_medications transaction when it fails', async () => {
    db.query
      .mockResolvedValueOnce({ rows: [{ patient_id: 5 }] })
      .mockResolvedValueOnce({ rows: [{ id: 1, ...validUpdate }] })
      .mockResolvedValueOnce({ rows: [{ patient_id: 5 }] });
    mockClient.query
      .mockResolvedValueOnce({ rows: [] })              // BEGIN
      .mockRejectedValueOnce(new Error('DB error'));    // own-row UPDATE throws
    const res = await request(adminApp).put('/1').send(validUpdate);
    expect(res.status).toBe(500);
    expect(mockClient.release).toHaveBeenCalled();
  });

  it('returns 500 when DB throws before the transaction starts', async () => {
    db.query.mockRejectedValue(new Error('DB error'));
    const res = await request(adminApp).put('/1').send(validUpdate);
    expect(res.status).toBe(500);
  });

  it('returns 403 when a scoped user tries to update another patient\'s prescription', async () => {
    db.query.mockResolvedValueOnce({ rows: [{ patient_id: OTHER_UUID }] }); // ownership check
    const res = await request(filteredApp).put('/1').send(validUpdate);
    expect(res.status).toBe(403);
  });
});

// ─── DELETE /:id ──────────────────────────────────────────────────────────

describe('DELETE /prescriptions/:id', () => {
  it('returns 404 when not found', async () => {
    db.query.mockResolvedValueOnce({ rows: [] }); // ownership check → not found
    const res = await request(adminApp).delete('/999');
    expect(res.status).toBe(404);
  });

  it('returns 200 on successful deletion', async () => {
    db.query
      .mockResolvedValueOnce({ rows: [{ patient_id: 5 }] })                          // ownership check
      .mockResolvedValueOnce({ rows: [{ appointment_id: 1, medication_id: 2 }] });   // DELETE
    const res = await request(adminApp).delete('/1');
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });

  it('returns 500 when DB throws', async () => {
    db.query.mockRejectedValue(new Error('DB error'));
    const res = await request(adminApp).delete('/1');
    expect(res.status).toBe(500);
  });

  it('returns 403 when a scoped user tries to delete another patient\'s prescription', async () => {
    db.query.mockResolvedValueOnce({ rows: [{ patient_id: OTHER_UUID }] }); // ownership check
    const res = await request(filteredApp).delete('/1');
    expect(res.status).toBe(403);
  });
});

// ─── GET /patient/:patient_id ──────────────────────────────────────────────

describe('GET /prescriptions/patient/:patient_id', () => {
  it('returns 400 for non-UUID patient_id', async () => {
    const res = await request(adminApp).get('/patient/not-a-uuid');
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/invalid patient id/i);
  });

  it('admin: returns prescriptions for any patient', async () => {
    db.query.mockResolvedValueOnce({ rows: [{ id: 1 }], rowCount: 1 });
    const res = await request(adminApp).get(`/patient/${PATIENT_UUID}`);
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });

  it('admin: supports status filter', async () => {
    db.query.mockResolvedValueOnce({ rows: [], rowCount: 0 });
    const res = await request(adminApp).get(`/patient/${PATIENT_UUID}`).query({ status: 'active' });
    expect(res.status).toBe(200);
  });

  it('user with matching patientId can access their own patient', async () => {
    db.query.mockResolvedValueOnce({ rows: [{ id: 1 }], rowCount: 1 });
    const res = await request(filteredApp).get(`/patient/${PATIENT_UUID}`);
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });

  it('user with different patientId is denied access', async () => {
    const res = await request(filteredApp).get(`/patient/${OTHER_UUID}`);
    expect(res.status).toBe(403);
    expect(res.body.error).toMatch(/access denied/i);
  });

  it('user with no patient access returns empty array', async () => {
    const res = await request(noneApp).get(`/patient/${PATIENT_UUID}`);
    expect(res.status).toBe(200);
    expect(res.body.data).toEqual([]);
    expect(res.body.count).toBe(0);
  });

  it('returns 500 when DB throws', async () => {
    db.query.mockRejectedValue(new Error('DB error'));
    const res = await request(adminApp).get(`/patient/${PATIENT_UUID}`);
    expect(res.status).toBe(500);
  });
});

// ─── GET /appointment/:appointment_id ─────────────────────────────────────

describe('GET /prescriptions/appointment/:appointment_id', () => {
  it('returns 400 for non-UUID appointment_id', async () => {
    const res = await request(adminApp).get('/appointment/not-a-uuid');
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/invalid appointment id/i);
  });

  it('admin: returns prescriptions for any appointment', async () => {
    db.query.mockResolvedValueOnce({ rows: [{ id: 1 }], rowCount: 1 });
    const res = await request(adminApp).get(`/appointment/${APPT_UUID}`);
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });

  it('user with patient access gets results filtered to their patient', async () => {
    db.query.mockResolvedValueOnce({ rows: [{ id: 1 }], rowCount: 1 });
    const res = await request(filteredApp).get(`/appointment/${APPT_UUID}`);
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });

  it('user with no patient access returns empty array', async () => {
    const res = await request(noneApp).get(`/appointment/${APPT_UUID}`);
    expect(res.status).toBe(200);
    expect(res.body.data).toEqual([]);
    expect(res.body.count).toBe(0);
  });

  it('returns 500 when DB throws', async () => {
    db.query.mockRejectedValue(new Error('DB error'));
    const res = await request(adminApp).get(`/appointment/${APPT_UUID}`);
    expect(res.status).toBe(500);
  });
});

// ─── GET / with patient_id filter (now ignored) ───────────────────────────

describe('GET /prescriptions patient_id query param', () => {
  it('patient_id query param is ignored — patient filtering is handled by RBAC middleware', async () => {
    db.query.mockResolvedValueOnce({ rows: [], rowCount: 0 });
    const res = await request(adminApp).get('/').query({ patient_id: '5' });
    expect(res.status).toBe(200);
  });
});
