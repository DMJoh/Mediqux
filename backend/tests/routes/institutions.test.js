const request = require('supertest');
const createApp = require('../helpers/createApp');

jest.mock('../../src/database/db', () => ({ query: jest.fn(), getClient: jest.fn() }));
jest.mock('../../src/middleware/auth', () => ({
  authenticateToken: (req, res, next) => next(),
  addPatientFilter: (req, res, next) => next(),
  requireAdmin: (req, res, next) => next(),
  buildPatientFilter: jest.fn().mockReturnValue({ whereClause: '', params: [] }),
}));

const db = require('../../src/database/db');
const institutionsRouter = require('../../src/routes/institutions');
const app = createApp(institutionsRouter);

let mockClient;
beforeEach(() => {
  db.query.mockReset();
  mockClient = { query: jest.fn(), release: jest.fn() };
  db.getClient.mockResolvedValue(mockClient);
});

describe('GET /institutions', () => {
  it('returns 200 with institutions list', async () => {
    db.query.mockResolvedValueOnce({ rows: [{ id: 1, name: 'City Hospital', doctor_count: 5 }] });
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

describe('GET /institutions/types/available', () => {
  it('returns merged list of types', async () => {
    db.query.mockResolvedValueOnce({ rows: [{ type: 'Radiology' }] });
    const res = await request(app).get('/types/available');
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data).toContain('Hospital');
    expect(res.body.data).toContain('Radiology');
  });

  it('returns 500 when DB throws', async () => {
    db.query.mockRejectedValue(new Error('DB error'));
    const res = await request(app).get('/types/available');
    expect(res.status).toBe(500);
  });
});

describe('GET /institutions/:id', () => {
  it('returns 200 with institution and its doctors', async () => {
    db.query
      .mockResolvedValueOnce({ rows: [{ id: 1, name: 'City Hospital' }] })
      .mockResolvedValueOnce({ rows: [{ id: 2, first_name: 'John', last_name: 'Doe' }] });
    const res = await request(app).get('/1');
    expect(res.status).toBe(200);
    expect(res.body.data.doctors).toHaveLength(1);
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

describe('POST /institutions', () => {
  it('returns 400 when name is missing', async () => {
    const res = await request(app).post('/').send({ type: 'hospital' });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/name is required/i);
  });

  it('returns 201 on success', async () => {
    db.query.mockResolvedValueOnce({ rows: [{ id: 5, name: 'New Clinic' }] });
    const res = await request(app).post('/').send({ name: 'New Clinic', type: 'clinic' });
    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
  });

  it('returns 500 when DB throws', async () => {
    db.query.mockRejectedValue(new Error('DB error'));
    const res = await request(app).post('/').send({ name: 'Test' });
    expect(res.status).toBe(500);
  });
});

describe('PUT /institutions/:id', () => {
  it('returns 400 when name is missing', async () => {
    const res = await request(app).put('/1').send({ type: 'clinic' });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/name is required/i);
  });

  it('returns 404 when not found', async () => {
    db.query.mockResolvedValueOnce({ rows: [] }); // UPDATE → not found
    const res = await request(app).put('/999').send({ name: 'Updated' });
    expect(res.status).toBe(404);
  });

  it('returns 200 on successful update', async () => {
    db.query.mockResolvedValueOnce({ rows: [{ id: 1, name: 'Updated Hospital' }] });
    const res = await request(app).put('/1').send({ name: 'Updated Hospital' });
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });

  it('returns 500 when DB throws', async () => {
    db.query.mockRejectedValue(new Error('DB error'));
    const res = await request(app).put('/1').send({ name: 'Test' });
    expect(res.status).toBe(500);
  });
});

describe('DELETE /institutions/:id', () => {
  it('returns 400 when institution has associated doctors', async () => {
    mockClient.query
      .mockResolvedValueOnce({ rows: [] })                            // BEGIN
      .mockResolvedValueOnce({ rows: [{ count: '3' }] })             // association count
      .mockResolvedValueOnce({ rows: [] });                           // ROLLBACK
    const res = await request(app).delete('/1');
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/associated doctor/i);
    expect(mockClient.release).toHaveBeenCalled();
  });

  it('returns 404 when not found', async () => {
    mockClient.query
      .mockResolvedValueOnce({ rows: [] })                            // BEGIN
      .mockResolvedValueOnce({ rows: [{ count: '0' }] })             // no associations
      .mockResolvedValueOnce({ rows: [] })                            // DELETE → not found
      .mockResolvedValueOnce({ rows: [] });                           // ROLLBACK
    const res = await request(app).delete('/999');
    expect(res.status).toBe(404);
    expect(mockClient.release).toHaveBeenCalled();
  });

  it('returns 200 on successful deletion', async () => {
    mockClient.query
      .mockResolvedValueOnce({ rows: [] })                                    // BEGIN
      .mockResolvedValueOnce({ rows: [{ count: '0' }] })                     // no associations
      .mockResolvedValueOnce({ rows: [{ id: 1, name: 'City Hospital' }] })   // DELETE RETURNING
      .mockResolvedValueOnce({ rows: [] });                                   // COMMIT
    const res = await request(app).delete('/1');
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(mockClient.release).toHaveBeenCalled();
  });

  it('returns 500 when transaction query throws', async () => {
    mockClient.query
      .mockResolvedValueOnce({ rows: [] })                             // BEGIN
      .mockRejectedValueOnce(new Error('DB error'));                   // association check throws
    const res = await request(app).delete('/1');
    expect(res.status).toBe(500);
    expect(mockClient.release).toHaveBeenCalled();
  });
});
