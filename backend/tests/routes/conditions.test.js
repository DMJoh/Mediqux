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
const conditionsRouter = require('../../src/routes/conditions');
const app = createApp(conditionsRouter);

beforeEach(() => db.query.mockReset());

// ─── GET /categories/list ─────────────────────────────────────────────────

describe('GET /conditions/categories/list', () => {
  it('returns merged list of common and existing categories', async () => {
    db.query.mockResolvedValueOnce({ rows: [{ category: 'Renal', count: 3 }] });
    const res = await request(app).get('/categories/list');
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    const categories = res.body.data.map(d => d.category);
    expect(categories).toContain('Renal');
    expect(categories).toContain('Cardiovascular');
  });

  it('returns 500 when DB throws', async () => {
    db.query.mockRejectedValue(new Error('DB error'));
    const res = await request(app).get('/categories/list');
    expect(res.status).toBe(500);
  });
});

// ─── GET /stats/summary ───────────────────────────────────────────────────

describe('GET /conditions/stats/summary', () => {
  it('returns 200 with stats data', async () => {
    db.query.mockResolvedValueOnce({ rows: [{ total_conditions: 10, active_conditions: 7 }] });
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

// ─── GET / ────────────────────────────────────────────────────────────────

describe('GET /conditions', () => {
  it('returns 200 with conditions list', async () => {
    db.query.mockResolvedValueOnce({ rows: [{ id: 1, name: 'Hypertension' }], rowCount: 1 });
    const res = await request(app).get('/');
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });

  it('supports category filter', async () => {
    db.query.mockResolvedValueOnce({ rows: [], rowCount: 0 });
    const res = await request(app).get('/').query({ category: 'Cardiovascular' });
    expect(res.status).toBe(200);
  });

  it('supports search query parameter', async () => {
    db.query.mockResolvedValueOnce({ rows: [], rowCount: 0 });
    const res = await request(app).get('/').query({ search: 'hyper' });
    expect(res.status).toBe(200);
  });

  it('returns 500 when DB throws', async () => {
    db.query.mockRejectedValue(new Error('DB error'));
    const res = await request(app).get('/');
    expect(res.status).toBe(500);
  });
});

// ─── GET /:id ─────────────────────────────────────────────────────────────

describe('GET /conditions/:id', () => {
  it('returns 200 with condition data', async () => {
    db.query.mockResolvedValueOnce({ rows: [{ id: 1, name: 'Hypertension' }] });
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

// ─── POST / ───────────────────────────────────────────────────────────────

describe('POST /conditions', () => {
  it('returns 400 when name is missing', async () => {
    const res = await request(app).post('/').send({ category: 'Cardiovascular' });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/name is required/i);
  });

  it('returns 400 when condition name already exists', async () => {
    db.query.mockResolvedValueOnce({ rows: [{ id: 1 }] }); // duplicate name
    const res = await request(app).post('/').send({ name: 'Hypertension' });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/already exists/i);
  });

  it('returns 400 when ICD code already exists', async () => {
    db.query
      .mockResolvedValueOnce({ rows: [] })        // no duplicate name
      .mockResolvedValueOnce({ rows: [{ id: 1 }] }); // duplicate ICD
    const res = await request(app).post('/').send({ name: 'New Condition', icd_code: 'I10' });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/icd code/i);
  });

  it('returns 201 on successful creation (no ICD code)', async () => {
    db.query
      .mockResolvedValueOnce({ rows: [] })   // no duplicate name
      .mockResolvedValueOnce({ rows: [{ id: 3, name: 'Diabetes Type 2' }] }); // INSERT
    const res = await request(app).post('/').send({ name: 'Diabetes Type 2', category: 'Endocrine' });
    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
  });

  it('returns 201 on successful creation (with ICD code, no conflicts)', async () => {
    db.query
      .mockResolvedValueOnce({ rows: [] })   // no duplicate name
      .mockResolvedValueOnce({ rows: [] })   // no duplicate ICD
      .mockResolvedValueOnce({ rows: [{ id: 4, name: 'Hypertension', icd_code: 'I10' }] }); // INSERT
    const res = await request(app).post('/').send({ name: 'Hypertension', icd_code: 'I10' });
    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
  });

  it('returns 500 when DB throws', async () => {
    db.query.mockRejectedValue(new Error('DB error'));
    const res = await request(app).post('/').send({ name: 'Test Condition' });
    expect(res.status).toBe(500);
  });
});

// ─── PUT /:id ─────────────────────────────────────────────────────────────

describe('PUT /conditions/:id', () => {
  it('returns 400 when name is missing', async () => {
    const res = await request(app).put('/1').send({ severity: 'High' });
    expect(res.status).toBe(400);
  });

  it('returns 400 when new name conflicts with another condition', async () => {
    db.query.mockResolvedValueOnce({ rows: [{ id: 2 }] }); // name conflict
    const res = await request(app).put('/1').send({ name: 'Existing Condition' });
    expect(res.status).toBe(400);
  });

  it('returns 404 when condition does not exist (UPDATE returns empty)', async () => {
    db.query
      .mockResolvedValueOnce({ rows: [] })   // no name conflict
      .mockResolvedValueOnce({ rows: [] });  // UPDATE → not found
    const res = await request(app).put('/999').send({ name: 'Updated Name' });
    expect(res.status).toBe(404);
  });

  it('returns 200 on successful update', async () => {
    db.query
      .mockResolvedValueOnce({ rows: [] })                                // no name conflict
      .mockResolvedValueOnce({ rows: [{ id: 1, name: 'Updated Name' }] }); // UPDATE
    const res = await request(app).put('/1').send({ name: 'Updated Name', severity: 'Low' });
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });

  it('also checks ICD code conflict when provided', async () => {
    db.query
      .mockResolvedValueOnce({ rows: [] })        // no name conflict
      .mockResolvedValueOnce({ rows: [{ id: 5 }] }); // ICD conflict
    const res = await request(app).put('/1').send({ name: 'Valid Name', icd_code: 'I10' });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/icd code/i);
  });

  it('returns 500 when DB throws', async () => {
    db.query.mockRejectedValue(new Error('DB error'));
    const res = await request(app).put('/1').send({ name: 'Test' });
    expect(res.status).toBe(500);
  });
});

// ─── DELETE /:id ──────────────────────────────────────────────────────────

describe('DELETE /conditions/:id', () => {
  it('returns 400 when condition is in use by appointments', async () => {
    db.query.mockResolvedValueOnce({ rows: [{ count: '3' }] }); // in use
    const res = await request(app).delete('/1');
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/referenced/i);
  });

  it('returns 404 when condition does not exist (DELETE returns empty)', async () => {
    db.query
      .mockResolvedValueOnce({ rows: [{ count: '0' }] })  // not in use
      .mockResolvedValueOnce({ rows: [] });                // DELETE → not found
    const res = await request(app).delete('/999');
    expect(res.status).toBe(404);
  });

  it('returns 200 on successful deletion', async () => {
    db.query
      .mockResolvedValueOnce({ rows: [{ count: '0' }] })          // not in use
      .mockResolvedValueOnce({ rows: [{ name: 'Hypertension' }] }); // DELETE RETURNING
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
