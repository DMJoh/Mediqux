const request = require('supertest');
const createApp = require('../helpers/createApp');

jest.mock('../../src/database/db', () => ({ query: jest.fn() }));
jest.mock('../../src/middleware/auth', () => ({
  authenticateToken: (req, res, next) => next(),
  addPatientFilter: (req, res, next) => next(),
  requireAdmin: (req, res, next) => next(),
  buildPatientFilter: jest.fn().mockReturnValue({ whereClause: '', params: [] }),
}));

const db = require('../../src/database/db');
const medicationsRouter = require('../../src/routes/medications');
const app = createApp(medicationsRouter);

beforeEach(() => db.query.mockReset());

describe('GET /medications', () => {
  it('returns 200 with medications list', async () => {
    db.query.mockResolvedValueOnce({ rows: [{ id: 1, name: 'Amoxicillin' }], rowCount: 1 });
    const res = await request(app).get('/');
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });

  it('filters by search query', async () => {
    db.query.mockResolvedValueOnce({ rows: [], rowCount: 0 });
    const res = await request(app).get('/').query({ search: 'amox' });
    expect(res.status).toBe(200);
  });

  it('filters by dosage_form', async () => {
    db.query.mockResolvedValueOnce({ rows: [], rowCount: 0 });
    const res = await request(app).get('/').query({ dosage_form: 'tablet' });
    expect(res.status).toBe(200);
  });

  it('filters by manufacturer', async () => {
    db.query.mockResolvedValueOnce({ rows: [], rowCount: 0 });
    const res = await request(app).get('/').query({ manufacturer: 'pfizer' });
    expect(res.status).toBe(200);
  });

  it('returns 500 when DB throws', async () => {
    db.query.mockRejectedValue(new Error('DB error'));
    const res = await request(app).get('/');
    expect(res.status).toBe(500);
  });
});

describe('GET /medications/:id', () => {
  it('returns 200 with medication data', async () => {
    db.query.mockResolvedValueOnce({ rows: [{ id: 1, name: 'Aspirin' }] });
    const res = await request(app).get('/1');
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });

  it('returns 404 when not found', async () => {
    db.query.mockResolvedValueOnce({ rows: [] });
    const res = await request(app).get('/999');
    expect(res.status).toBe(404);
  });

  it('returns 500 when DB throws', async () => {
    db.query.mockRejectedValue(new Error('DB error'));
    const res = await request(app).get('/1');
    expect(res.status).toBe(500);
  });
});

describe('POST /medications', () => {
  it('returns 400 when name is missing', async () => {
    const res = await request(app).post('/').send({ generic_name: 'x' });
    expect(res.status).toBe(400);
  });

  it('returns 400 when medication name already exists', async () => {
    db.query.mockResolvedValueOnce({ rows: [{ id: 1 }] });
    const res = await request(app).post('/').send({ name: 'Aspirin' });
    expect(res.status).toBe(400);
  });

  it('returns 201 on successful creation with all fields', async () => {
    db.query
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [{ id: 3, name: 'NewMed' }] });
    const res = await request(app).post('/').send({
      name: 'NewMed', generic_name: 'nm',
      dosage_forms: ['Tablet', 'Capsule'], strengths: ['500mg'],
      active_ingredients: [{ name: 'Amoxicillin', amount: '500', unit: 'mg' }],
      manufacturer: 'Pharma Co', description: 'Antibiotic',
    });
    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
  });

  it('returns 500 when DB throws', async () => {
    db.query.mockRejectedValue(new Error('DB error'));
    const res = await request(app).post('/').send({ name: 'Test' });
    expect(res.status).toBe(500);
  });
});

describe('PUT /medications/:id', () => {
  it('returns 400 when name is missing', async () => {
    const res = await request(app).put('/1').send({ generic_name: 'x' });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/name is required/i);
  });

  it('returns 400 when name conflicts with another medication', async () => {
    db.query.mockResolvedValueOnce({ rows: [{ id: 2 }] }); // duplicate name
    const res = await request(app).put('/1').send({ name: 'Aspirin' });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/already exists/i);
  });

  it('returns 404 when not found', async () => {
    db.query
      .mockResolvedValueOnce({ rows: [] })   // no name conflict
      .mockResolvedValueOnce({ rows: [] });  // UPDATE → not found
    const res = await request(app).put('/999').send({ name: 'Updated' });
    expect(res.status).toBe(404);
  });

  it('returns 200 on successful update with all fields', async () => {
    db.query
      .mockResolvedValueOnce({ rows: [] })                                 // no name conflict
      .mockResolvedValueOnce({ rows: [{ id: 1, name: 'Updated' }] });    // UPDATE
    const res = await request(app).put('/1').send({
      name: 'Updated', generic_name: 'upd',
      dosage_forms: ['Syrup'], strengths: ['250mg'],
      active_ingredients: [{ name: 'X', amount: '10', unit: 'mg' }],
      manufacturer: 'Acme', description: 'Updated med',
    });
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });

  it('returns 500 when DB throws', async () => {
    db.query.mockRejectedValue(new Error('DB error'));
    const res = await request(app).put('/1').send({ name: 'Updated' });
    expect(res.status).toBe(500);
  });
});

describe('DELETE /medications/:id', () => {
  it('returns 400 when medication is in use', async () => {
    db.query.mockResolvedValueOnce({ rows: [{ prescription_count: '2', patient_medication_count: '1' }] });
    const res = await request(app).delete('/1');
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/referenced/i);
  });

  it('returns 404 when not found', async () => {
    db.query
      .mockResolvedValueOnce({ rows: [] })   // usageCheck: not in any relation
      .mockResolvedValueOnce({ rows: [] });  // DELETE → not found
    const res = await request(app).delete('/999');
    expect(res.status).toBe(404);
  });

  it('returns 200 on successful deletion', async () => {
    db.query
      .mockResolvedValueOnce({ rows: [{ prescription_count: '0', patient_medication_count: '0' }] }) // not in use
      .mockResolvedValueOnce({ rows: [{ name: 'Aspirin' }] });  // DELETE RETURNING
    const res = await request(app).delete('/1');
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });

  it('returns 500 when DB throws', async () => {
    db.query.mockRejectedValue(new Error('DB error'));
    const res = await request(app).delete('/1');
    expect(res.status).toBe(500);
  });
});

describe('GET /medications/forms/available', () => {
  it('returns merged list of dosage forms', async () => {
    db.query.mockResolvedValueOnce({ rows: [{ form: 'Liquid' }] });
    const res = await request(app).get('/forms/available');
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data).toContain('Tablet');
    expect(res.body.data).toContain('Liquid');
  });

  it('returns 500 when DB throws', async () => {
    db.query.mockRejectedValue(new Error('DB error'));
    const res = await request(app).get('/forms/available');
    expect(res.status).toBe(500);
  });
});

describe('GET /medications/manufacturers/list', () => {
  it('returns manufacturers list', async () => {
    db.query.mockResolvedValueOnce({ rows: [{ manufacturer: 'Pfizer', count: '3' }] });
    const res = await request(app).get('/manufacturers/list');
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });

  it('returns 500 when DB throws', async () => {
    db.query.mockRejectedValue(new Error('DB error'));
    const res = await request(app).get('/manufacturers/list');
    expect(res.status).toBe(500);
  });
});

describe('GET /medications/stats/summary', () => {
  it('returns medication statistics', async () => {
    db.query.mockResolvedValueOnce({ rows: [{ total_medications: 10, total_manufacturers: 3 }] });
    const res = await request(app).get('/stats/summary');
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });

  it('returns 500 when DB throws', async () => {
    db.query.mockRejectedValue(new Error('DB error'));
    const res = await request(app).get('/stats/summary');
    expect(res.status).toBe(500);
  });
});
