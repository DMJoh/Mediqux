const request = require('supertest');
const createApp = require('../helpers/createApp');

jest.mock('../../src/database/db', () => ({
  query: jest.fn(),
  getClient: jest.fn(),
}));
jest.mock('../../src/middleware/auth', () => ({
  authenticateToken: (req, res, next) => next(),
  addPatientFilter: (req, res, next) => next(),
  requireAdmin: (req, res, next) => next(),
  buildPatientFilter: jest.fn().mockReturnValue({ whereClause: '', params: [] }),
}));

const db = require('../../src/database/db');
const doctorsRouter = require('../../src/routes/doctors');
const app = createApp(doctorsRouter);

// Re-usable mock transaction client
let mockClient;
beforeEach(() => {
  db.query.mockReset();
  mockClient = { query: jest.fn(), release: jest.fn() };
  db.getClient.mockResolvedValue(mockClient);
});

// ─── GET /institutions/available ─────────────────────────────────────────

describe('GET /doctors/institutions/available', () => {
  it('returns 200 with institution list', async () => {
    db.query.mockResolvedValueOnce({ rows: [{ id: 1, name: 'City Hospital', type: 'hospital' }] });
    const res = await request(app).get('/institutions/available');
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(Array.isArray(res.body.data)).toBe(true);
  });

  it('returns 500 when DB throws', async () => {
    db.query.mockRejectedValue(new Error('DB error'));
    const res = await request(app).get('/institutions/available');
    expect(res.status).toBe(500);
  });
});

// ─── GET / ────────────────────────────────────────────────────────────────

describe('GET /doctors', () => {
  it('returns 200 with doctors array', async () => {
    db.query.mockResolvedValueOnce({ rows: [{ id: 1, first_name: 'Dr. Smith', institutions: [] }], rowCount: 1 });
    const res = await request(app).get('/');
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data).toHaveLength(1);
  });

  it('returns 500 when DB throws', async () => {
    db.query.mockRejectedValue(new Error('DB error'));
    const res = await request(app).get('/');
    expect(res.status).toBe(500);
  });
});

// ─── GET /:id ─────────────────────────────────────────────────────────────

describe('GET /doctors/:id', () => {
  it('returns 200 with doctor data', async () => {
    db.query.mockResolvedValueOnce({ rows: [{ id: 1, first_name: 'Alice', last_name: 'Smith', institutions: [] }] });
    const res = await request(app).get('/1');
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });

  it('returns 404 when doctor not found', async () => {
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

describe('POST /doctors', () => {
  const validDoctor = { first_name: 'Jane', last_name: 'Doe', specialty: 'Cardiology', phone: '555-1234', email: 'jane@hospital.com' };

  it('returns 400 when first_name or last_name is missing', async () => {
    const res = await request(app).post('/').send({ specialty: 'Cardiology' });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/required/i);
  });

  it('returns 201 on successful creation (no institutions)', async () => {
    mockClient.query
      .mockResolvedValueOnce({ rows: [] })                                  // BEGIN
      .mockResolvedValueOnce({ rows: [{ id: 3, ...validDoctor }] })        // INSERT
      .mockResolvedValueOnce({ rows: [] });                                 // COMMIT
    const res = await request(app).post('/').send(validDoctor);
    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(mockClient.release).toHaveBeenCalled();
  });

  it('returns 201 and links institutions when institution_ids provided', async () => {
    mockClient.query
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [{ id: 3, ...validDoctor }] })
      .mockResolvedValueOnce({ rows: [] }) // INSERT doctor_institution
      .mockResolvedValueOnce({ rows: [] }); // COMMIT
    const res = await request(app).post('/').send({ ...validDoctor, institution_ids: [1] });
    expect(res.status).toBe(201);
  });

  it('returns 500 and calls ROLLBACK when client.query throws', async () => {
    mockClient.query
      .mockResolvedValueOnce({ rows: [] })               // BEGIN
      .mockRejectedValueOnce(new Error('Insert failed')); // INSERT throws
    const res = await request(app).post('/').send(validDoctor);
    expect(res.status).toBe(500);
    expect(mockClient.release).toHaveBeenCalled();
  });

  it('returns 500 when getClient itself throws', async () => {
    db.getClient.mockRejectedValue(new Error('Connection pool exhausted'));
    const res = await request(app).post('/').send(validDoctor);
    expect(res.status).toBe(500);
  });
});

// ─── PUT /:id ─────────────────────────────────────────────────────────────

describe('PUT /doctors/:id', () => {
  const updatedDoctor = { first_name: 'Jane', last_name: 'Updated', specialty: 'Neurology' };

  it('returns 200 on successful update', async () => {
    mockClient.query
      .mockResolvedValueOnce({ rows: [] })                                      // BEGIN
      .mockResolvedValueOnce({ rows: [{ id: 1, ...updatedDoctor }] })          // UPDATE
      .mockResolvedValueOnce({ rows: [] })                                      // DELETE doctor_institutions
      .mockResolvedValueOnce({ rows: [] });                                     // COMMIT
    const res = await request(app).put('/1').send(updatedDoctor);
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(mockClient.release).toHaveBeenCalled();
  });

  it('returns 404 when doctor not found (UPDATE returns empty)', async () => {
    mockClient.query
      .mockResolvedValueOnce({ rows: [] })  // BEGIN
      .mockResolvedValueOnce({ rows: [] })  // UPDATE → not found
      .mockResolvedValueOnce({ rows: [] }); // ROLLBACK
    const res = await request(app).put('/999').send(updatedDoctor);
    expect(res.status).toBe(404);
    expect(mockClient.release).toHaveBeenCalled();
  });

  it('returns 500 when client.query throws', async () => {
    mockClient.query
      .mockResolvedValueOnce({ rows: [] })               // BEGIN
      .mockRejectedValueOnce(new Error('Update failed')); // UPDATE throws
    const res = await request(app).put('/1').send(updatedDoctor);
    expect(res.status).toBe(500);
    expect(mockClient.release).toHaveBeenCalled();
  });
});

// ─── DELETE /:id ──────────────────────────────────────────────────────────

describe('DELETE /doctors/:id', () => {
  it('returns 200 on successful deletion', async () => {
    db.query
      .mockResolvedValueOnce({ rows: [{ id: 1 }] }) // doctor exists
      .mockResolvedValueOnce({ rows: [] });          // DELETE
    const res = await request(app).delete('/1');
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });

  it('returns 404 when doctor not found', async () => {
    db.query.mockResolvedValueOnce({ rows: [] });
    const res = await request(app).delete('/999');
    expect(res.status).toBe(404);
  });

  it('returns 500 when DB throws', async () => {
    db.query.mockRejectedValue(new Error('DB error'));
    const res = await request(app).delete('/1');
    expect(res.status).toBe(500);
  });
});
