const request = require('supertest');
const createApp = require('../helpers/createApp');

jest.mock('../../src/database/db', () => ({ query: jest.fn(), getClient: jest.fn() }));
jest.mock('../../src/middleware/auth', () => ({
  addPatientFilter: (req, res, next) => next(),
  authenticateToken: (req, res, next) => next(),
  requireAdmin: (req, res, next) => next(),
  buildPatientFilter: jest.fn().mockReturnValue({ whereClause: '', params: [] }),
}));

const db = require('../../src/database/db');
const prescriptionsRouter = require('../../src/routes/prescriptions');

const adminApp    = createApp(prescriptionsRouter, { role: 'admin' });
const noneApp     = createApp(prescriptionsRouter, { role: 'user', patientId: null });
const filteredApp = createApp(prescriptionsRouter, { role: 'user', patientId: 5 });

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

  it('returns 201 on successful creation (new patient medication)', async () => {
    db.query
      .mockResolvedValueOnce({ rows: [{ id: 1, patient_id: 5 }] })    // appointment check
      .mockResolvedValueOnce({ rows: [{ id: 2, name: 'Aspirin' }] }); // medication check
    mockClient.query
      .mockResolvedValueOnce({ rows: [] })                              // BEGIN
      .mockResolvedValueOnce({ rows: [{ id: 5, ...validPrescription }] }) // INSERT prescription
      .mockResolvedValueOnce({ rows: [] })                              // check patient_medications → none
      .mockResolvedValueOnce({ rows: [] })                              // INSERT patient_medications
      .mockResolvedValueOnce({ rows: [] });                             // COMMIT
    const res = await request(adminApp).post('/').send(validPrescription);
    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(mockClient.release).toHaveBeenCalled();
  });

  it('returns 201 when patient medication already exists (UPDATE path)', async () => {
    db.query
      .mockResolvedValueOnce({ rows: [{ id: 1, patient_id: 5 }] })
      .mockResolvedValueOnce({ rows: [{ id: 2, name: 'Aspirin' }] });
    mockClient.query
      .mockResolvedValueOnce({ rows: [] })                              // BEGIN
      .mockResolvedValueOnce({ rows: [{ id: 5, ...validPrescription }] }) // INSERT prescription
      .mockResolvedValueOnce({ rows: [{ id: 10 }] })                   // existing patient_medication found
      .mockResolvedValueOnce({ rows: [] })                              // UPDATE patient_medications
      .mockResolvedValueOnce({ rows: [] });                             // COMMIT
    const res = await request(adminApp).post('/').send(validPrescription);
    expect(res.status).toBe(201);
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
    db.query.mockResolvedValueOnce({ rows: [] }); // UPDATE → not found
    const res = await request(adminApp).put('/999').send(validUpdate);
    expect(res.status).toBe(404);
  });

  it('returns 200 on successful update', async () => {
    db.query.mockResolvedValueOnce({ rows: [{ id: 1, ...validUpdate }] }); // UPDATE
    const res = await request(adminApp).put('/1').send(validUpdate);
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });

  it('returns 200 and updates patient medication status when status != active', async () => {
    db.query
      .mockResolvedValueOnce({ rows: [{ id: 1, ...validUpdate }] })          // UPDATE prescription
      .mockResolvedValueOnce({ rows: [{ patient_id: 5 }] })                  // get appointment
      .mockResolvedValueOnce({ rows: [] });                                   // UPDATE patient_medications
    const res = await request(adminApp).put('/1').send({ ...validUpdate, status: 'completed' });
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });

  it('returns 500 when DB throws', async () => {
    db.query.mockRejectedValue(new Error('DB error'));
    const res = await request(adminApp).put('/1').send(validUpdate);
    expect(res.status).toBe(500);
  });
});

// ─── DELETE /:id ──────────────────────────────────────────────────────────

describe('DELETE /prescriptions/:id', () => {
  it('returns 404 when not found', async () => {
    db.query.mockResolvedValueOnce({ rows: [] }); // DELETE → not found
    const res = await request(adminApp).delete('/999');
    expect(res.status).toBe(404);
  });

  it('returns 200 on successful deletion', async () => {
    db.query.mockResolvedValueOnce({ rows: [{ appointment_id: 1, medication_id: 2 }] });
    const res = await request(adminApp).delete('/1');
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });

  it('returns 500 when DB throws', async () => {
    db.query.mockRejectedValue(new Error('DB error'));
    const res = await request(adminApp).delete('/1');
    expect(res.status).toBe(500);
  });
});

// ─── GET /patient/:patient_id ──────────────────────────────────────────────

describe('GET /prescriptions/patient/:patient_id', () => {
  it('returns prescriptions for a patient', async () => {
    db.query.mockResolvedValueOnce({ rows: [{ id: 1 }], rowCount: 1 });
    const res = await request(adminApp).get('/patient/5');
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });

  it('supports status filter', async () => {
    db.query.mockResolvedValueOnce({ rows: [], rowCount: 0 });
    const res = await request(adminApp).get('/patient/5').query({ status: 'active' });
    expect(res.status).toBe(200);
  });

  it('returns 500 when DB throws', async () => {
    db.query.mockRejectedValue(new Error('DB error'));
    const res = await request(adminApp).get('/patient/5');
    expect(res.status).toBe(500);
  });
});

// ─── GET /appointment/:appointment_id ─────────────────────────────────────

describe('GET /prescriptions/appointment/:appointment_id', () => {
  it('returns prescriptions for an appointment', async () => {
    db.query.mockResolvedValueOnce({ rows: [{ id: 1 }], rowCount: 1 });
    const res = await request(adminApp).get('/appointment/1');
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });

  it('returns 500 when DB throws', async () => {
    db.query.mockRejectedValue(new Error('DB error'));
    const res = await request(adminApp).get('/appointment/1');
    expect(res.status).toBe(500);
  });
});

// ─── GET / with patient_id filter ─────────────────────────────────────────

describe('GET /prescriptions with patient_id filter', () => {
  it('admin: supports patient_id query filter', async () => {
    db.query.mockResolvedValueOnce({ rows: [], rowCount: 0 });
    const res = await request(adminApp).get('/').query({ patient_id: '5' });
    expect(res.status).toBe(200);
  });
});
