const request = require('supertest');
const createApp = require('../helpers/createApp');

jest.mock('../../src/database/db', () => ({ query: jest.fn() }));
jest.mock('../../src/middleware/auth', () => ({
  addPatientFilter: (req, res, next) => next(), // patientFilter already set by createApp
  authenticateToken: (req, res, next) => next(),
  requireAdmin: (req, res, next) => next(),
  buildPatientFilter: jest.fn().mockReturnValue({ whereClause: '', params: [] }),
}));

const db = require('../../src/database/db');
const patientsRouter = require('../../src/routes/patients');

const adminApp = createApp(patientsRouter, { role: 'admin' });
const userApp  = createApp(patientsRouter, { role: 'user', patientId: 10 });
const noPatientApp = createApp(patientsRouter, { role: 'user', patientId: null });

beforeEach(() => db.query.mockReset());

// ─── GET / ────────────────────────────────────────────────────────────────

describe('GET /patients', () => {
  it('admin: returns all patients', async () => {
    db.query.mockResolvedValueOnce({ rows: [{ id: 1, first_name: 'Alice' }], rowCount: 1 });
    const res = await request(adminApp).get('/');
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data).toHaveLength(1);
  });

  it('user with patientId: returns filtered results', async () => {
    db.query.mockResolvedValueOnce({ rows: [{ id: 10 }], rowCount: 1 });
    const res = await request(userApp).get('/');
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });

  it('user with no patientId (patientFilter="none"): returns empty array without hitting DB', async () => {
    // createApp sets patientFilter='none' when patientId is null and role is 'user'
    const res = await request(noPatientApp).get('/');
    expect(res.status).toBe(200);
    expect(res.body.data).toEqual([]);
    expect(res.body.count).toBe(0);
  });

  it('returns 500 when DB throws', async () => {
    db.query.mockRejectedValue(new Error('DB down'));
    const res = await request(adminApp).get('/');
    expect(res.status).toBe(500);
    expect(res.body.success).toBe(false);
  });
});

// ─── GET /:id ─────────────────────────────────────────────────────────────

describe('GET /patients/:id', () => {
  it('returns 200 with patient data', async () => {
    db.query.mockResolvedValueOnce({ rows: [{ id: 1, first_name: 'Alice', last_name: 'Smith' }] });
    const res = await request(adminApp).get('/1');
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.first_name).toBe('Alice');
  });

  it('returns 404 when patient not found', async () => {
    db.query.mockResolvedValueOnce({ rows: [] });
    const res = await request(adminApp).get('/999');
    expect(res.status).toBe(404);
    expect(res.body.success).toBe(false);
  });

  it('returns 500 when DB throws', async () => {
    db.query.mockRejectedValue(new Error('DB error'));
    const res = await request(adminApp).get('/1');
    expect(res.status).toBe(500);
  });
});

// ─── POST / ───────────────────────────────────────────────────────────────

describe('POST /patients', () => {
  const validPatient = {
    first_name: 'Bob', last_name: 'Jones',
    date_of_birth: '1990-05-15', gender: 'male',
    phone: '555-1234', email: 'bob@example.com'
  };

  it('returns 201 on successful patient creation', async () => {
    db.query.mockResolvedValueOnce({ rows: [{ id: 2, ...validPatient }] });
    const res = await request(adminApp).post('/').send(validPatient);
    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
  });

  it('returns 500 when DB throws', async () => {
    db.query.mockRejectedValue(new Error('constraint violation'));
    const res = await request(adminApp).post('/').send(validPatient);
    expect(res.status).toBe(500);
  });
});

// ─── PUT /:id ─────────────────────────────────────────────────────────────

describe('PUT /patients/:id', () => {
  const updatedFields = { first_name: 'Alice', last_name: 'Updated', date_of_birth: '1990-01-01', gender: 'female' };

  it('returns 200 on successful update', async () => {
    db.query.mockResolvedValueOnce({ rows: [{ id: 1, ...updatedFields }] });
    const res = await request(adminApp).put('/1').send(updatedFields);
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });

  it('returns 404 when patient not found', async () => {
    db.query.mockResolvedValueOnce({ rows: [] });
    const res = await request(adminApp).put('/999').send(updatedFields);
    expect(res.status).toBe(404);
  });

  it('returns 500 when DB throws', async () => {
    db.query.mockRejectedValue(new Error('DB error'));
    const res = await request(adminApp).put('/1').send(updatedFields);
    expect(res.status).toBe(500);
  });
});

// ─── DELETE /:id ──────────────────────────────────────────────────────────

describe('DELETE /patients/:id', () => {
  it('returns 200 on successful deletion', async () => {
    db.query.mockResolvedValueOnce({ rows: [{ id: 1 }] }); // exists check or DELETE returning
    const res = await request(adminApp).delete('/1');
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });

  it('returns 404 when patient not found', async () => {
    db.query.mockResolvedValueOnce({ rows: [] });
    const res = await request(adminApp).delete('/999');
    expect(res.status).toBe(404);
  });

  it('returns 500 when DB throws', async () => {
    db.query.mockRejectedValue(new Error('DB error'));
    const res = await request(adminApp).delete('/1');
    expect(res.status).toBe(500);
  });
});
