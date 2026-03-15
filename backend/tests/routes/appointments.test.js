const request = require('supertest');
const createApp = require('../helpers/createApp');

jest.mock('../../src/database/db', () => ({ query: jest.fn() }));
jest.mock('../../src/middleware/auth', () => ({
  addPatientFilter: (req, res, next) => next(),
  authenticateToken: (req, res, next) => next(),
  requireAdmin: (req, res, next) => next(),
  buildPatientFilter: jest.fn().mockReturnValue({ whereClause: '', params: [] }),
}));

const db = require('../../src/database/db');
const appointmentsRouter = require('../../src/routes/appointments');

const adminApp = createApp(appointmentsRouter, { role: 'admin' });
const noneApp  = createApp(appointmentsRouter, { role: 'user', patientId: null });

beforeEach(() => db.query.mockReset());

// ─── GET /dashboard/upcoming ──────────────────────────────────────────────

describe('GET /appointments/dashboard/upcoming', () => {
  it('returns empty array when patientFilter is "none"', async () => {
    const res = await request(noneApp).get('/dashboard/upcoming');
    expect(res.status).toBe(200);
    expect(res.body.data).toEqual([]);
  });

  it('returns upcoming appointments for admin', async () => {
    db.query.mockResolvedValueOnce({ rows: [{ id: 1, appointment_date: '2027-01-01' }] });
    const res = await request(adminApp).get('/dashboard/upcoming');
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });

  it('returns 500 when DB throws', async () => {
    db.query.mockRejectedValue(new Error('DB error'));
    const res = await request(adminApp).get('/dashboard/upcoming');
    expect(res.status).toBe(500);
  });
});

// ─── GET /stats/summary ───────────────────────────────────────────────────

describe('GET /appointments/stats/summary', () => {
  it('returns empty stats when patientFilter is "none"', async () => {
    const res = await request(noneApp).get('/stats/summary');
    expect(res.status).toBe(200);
    expect(res.body.data.total_appointments).toBe(0);
  });

  it('returns stats for admin', async () => {
    db.query.mockResolvedValueOnce({ rows: [{ total_appointments: 5, upcoming: 2, completed: 3, cancelled: 0, today: 1 }] });
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

// ─── GET / ────────────────────────────────────────────────────────────────

describe('GET /appointments', () => {
  it('returns empty array when patientFilter is "none"', async () => {
    const res = await request(noneApp).get('/');
    expect(res.status).toBe(200);
    expect(res.body.data).toEqual([]);
  });

  it('returns 200 with appointments list', async () => {
    db.query.mockResolvedValueOnce({ rows: [{ id: 1 }], rowCount: 1 });
    const res = await request(adminApp).get('/');
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });

  it('supports status filter', async () => {
    db.query.mockResolvedValueOnce({ rows: [], rowCount: 0 });
    const res = await request(adminApp).get('/').query({ status: 'scheduled' });
    expect(res.status).toBe(200);
  });

  it('supports patient_id filter', async () => {
    db.query.mockResolvedValueOnce({ rows: [], rowCount: 0 });
    const res = await request(adminApp).get('/').query({ patient_id: 1 });
    expect(res.status).toBe(200);
  });

  it('supports doctor_id, date_from, date_to filters', async () => {
    db.query.mockResolvedValueOnce({ rows: [], rowCount: 0 });
    const res = await request(adminApp).get('/').query({ doctor_id: 1, date_from: '2025-01-01', date_to: '2025-12-31' });
    expect(res.status).toBe(200);
  });

  it('returns 500 when DB throws', async () => {
    db.query.mockRejectedValue(new Error('DB error'));
    const res = await request(adminApp).get('/');
    expect(res.status).toBe(500);
  });
});

// ─── GET /:id ─────────────────────────────────────────────────────────────

describe('GET /appointments/:id', () => {
  it('returns 200 with appointment data', async () => {
    db.query.mockResolvedValueOnce({ rows: [{ id: 1 }] });
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

describe('POST /appointments', () => {
  it('returns 400 when patient_id is missing', async () => {
    const res = await request(adminApp).post('/').send({ appointment_date: '2027-06-01T10:00:00' });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/required/i);
  });

  it('returns 400 when appointment_date is missing', async () => {
    const res = await request(adminApp).post('/').send({ patient_id: 1 });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/required/i);
  });

  it('returns 400 when scheduling in the past with status "scheduled"', async () => {
    const res = await request(adminApp).post('/').send({
      patient_id: 1,
      appointment_date: '2020-01-01T10:00:00', // past date
      status: 'scheduled',
    });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/past/i);
  });

  it('returns 201 with future appointment date', async () => {
    db.query.mockResolvedValueOnce({ rows: [{ id: 5, patient_id: 1, appointment_date: '2027-06-01T10:00:00' }] });
    const res = await request(adminApp).post('/').send({
      patient_id: 1,
      appointment_date: '2027-06-01T10:00:00',
      type: 'consultation',
    });
    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
  });

  it('returns 201 with past date when status is "completed"', async () => {
    db.query.mockResolvedValueOnce({ rows: [{ id: 6, patient_id: 1 }] });
    const res = await request(adminApp).post('/').send({
      patient_id: 1,
      appointment_date: '2020-01-01T10:00:00',
      status: 'completed',
    });
    expect(res.status).toBe(201);
  });

  it('returns 500 when DB throws', async () => {
    db.query.mockRejectedValue(new Error('DB error'));
    const res = await request(adminApp).post('/').send({
      patient_id: 1,
      appointment_date: '2027-06-01T10:00:00',
    });
    expect(res.status).toBe(500);
  });
});

// ─── PUT /:id ─────────────────────────────────────────────────────────────

describe('PUT /appointments/:id', () => {
  const updateBody = { patient_id: 1, appointment_date: '2027-07-01T10:00:00', type: 'follow-up', status: 'scheduled' };

  it('returns 200 on successful update', async () => {
    db.query.mockResolvedValueOnce({ rows: [{ id: 1, ...updateBody }] });
    const res = await request(adminApp).put('/1').send(updateBody);
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });

  it('returns 404 when appointment not found', async () => {
    db.query.mockResolvedValueOnce({ rows: [] });
    const res = await request(adminApp).put('/999').send(updateBody);
    expect(res.status).toBe(404);
  });

  it('returns 500 when DB throws', async () => {
    db.query.mockRejectedValue(new Error('DB error'));
    const res = await request(adminApp).put('/1').send(updateBody);
    expect(res.status).toBe(500);
  });
});

// ─── DELETE /:id ──────────────────────────────────────────────────────────

describe('DELETE /appointments/:id', () => {
  it('returns 409 when appointment has linked test results', async () => {
    db.query.mockResolvedValueOnce({ rows: [{ count: '3' }] }); // linked test results
    const res = await request(adminApp).delete('/1');
    expect(res.status).toBe(409);
    expect(res.body.error).toMatch(/test results/i);
  });

  it('returns 404 when not found', async () => {
    db.query
      .mockResolvedValueOnce({ rows: [{ count: '0' }] })  // no linked test results
      .mockResolvedValueOnce({ rows: [] });                // DELETE → not found
    const res = await request(adminApp).delete('/999');
    expect(res.status).toBe(404);
  });

  it('returns 200 on successful deletion', async () => {
    db.query
      .mockResolvedValueOnce({ rows: [{ count: '0' }] })                          // no linked test results
      .mockResolvedValueOnce({ rows: [{ id: 1, appointment_date: '2027-01-01' }] }); // DELETE RETURNING
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
