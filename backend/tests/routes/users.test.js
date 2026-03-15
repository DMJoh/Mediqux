const request = require('supertest');
const createApp = require('../helpers/createApp');

jest.mock('../../src/database/db', () => ({ query: jest.fn() }));
jest.mock('../../src/middleware/auth', () => ({
  requireAdmin: (req, res, next) => {
    if (req.user && req.user.role === 'admin') return next();
    return res.status(403).json({ success: false, error: 'Insufficient permissions' });
  },
  authenticateToken: (req, res, next) => next(),
  addPatientFilter: (req, res, next) => next(),
  buildPatientFilter: jest.fn().mockReturnValue({ whereClause: '', params: [] }),
}));

const db = require('../../src/database/db');
const usersRouter = require('../../src/routes/users');

const adminApp = createApp(usersRouter, { role: 'admin' });
const userApp  = createApp(usersRouter, { role: 'user' });

beforeEach(() => db.query.mockReset());

// ─── GET / (admin only) ───────────────────────────────────────────────────

describe('GET /users', () => {
  it('admin: returns all users', async () => {
    db.query.mockResolvedValueOnce({ rows: [{ id: 1, username: 'alice', role: 'admin' }], rowCount: 1 });
    const res = await request(adminApp).get('/');
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data).toHaveLength(1);
  });

  it('non-admin: returns 403', async () => {
    const res = await request(userApp).get('/');
    expect(res.status).toBe(403);
  });

  it('admin: returns 500 when DB throws', async () => {
    db.query.mockRejectedValue(new Error('DB down'));
    const res = await request(adminApp).get('/');
    expect(res.status).toBe(500);
  });
});

// ─── POST / (admin only) ──────────────────────────────────────────────────

describe('POST /users', () => {
  const validUser = {
    username: 'newuser', email: 'new@example.com',
    password: 'pass123', firstName: 'New', lastName: 'User',
    role: 'user',
  };

  it('returns 403 for non-admin', async () => {
    const res = await request(userApp).post('/').send(validUser);
    expect(res.status).toBe(403);
  });

  it('returns 400 when required fields are missing', async () => {
    const res = await request(adminApp).post('/').send({ username: 'incomplete' });
    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
  });

  it('returns 400 when username/email already exists', async () => {
    db.query.mockResolvedValueOnce({ rows: [{ id: 1 }] });
    const res = await request(adminApp).post('/').send(validUser);
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/already exists/i);
  });

  it('returns 400 when patientId provided but patient not found', async () => {
    db.query
      .mockResolvedValueOnce({ rows: [] })   // no existing user
      .mockResolvedValueOnce({ rows: [] });  // patient not found
    const res = await request(adminApp).post('/').send({ ...validUser, patientId: 99 });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/patient not found/i);
  });

  it('returns 201 on successful user creation (no patientId)', async () => {
    db.query
      .mockResolvedValueOnce({ rows: [] })   // no existing user
      .mockResolvedValueOnce({               // INSERT
        rows: [{ id: 5, username: 'newuser', email: 'new@example.com',
                 first_name: 'New', last_name: 'User', role: 'user',
                 patient_id: null, created_at: new Date() }]
      });
    const res = await request(adminApp).post('/').send(validUser);
    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
  });

  it('returns 201 when patientId is valid', async () => {
    db.query
      .mockResolvedValueOnce({ rows: [] })          // no existing user
      .mockResolvedValueOnce({ rows: [{ id: 10 }] }) // patient exists
      .mockResolvedValueOnce({ rows: [{ id: 5, username: 'newuser', email: 'new@example.com',
        first_name: 'New', last_name: 'User', role: 'user', patient_id: 10, created_at: new Date() }] });
    const res = await request(adminApp).post('/').send({ ...validUser, patientId: 10 });
    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
  });

  it('returns 500 when DB throws', async () => {
    db.query.mockRejectedValue(new Error('DB error'));
    const res = await request(adminApp).post('/').send(validUser);
    expect(res.status).toBe(500);
  });
});

// ─── PUT /:id (admin only) ────────────────────────────────────────────────

describe('PUT /users/:id', () => {
  const updateBody = { username: 'updated', email: 'u@u.com', firstName: 'Up', lastName: 'Date', role: 'user', isActive: true };

  it('returns 403 for non-admin', async () => {
    const res = await request(userApp).put('/2').send(updateBody);
    expect(res.status).toBe(403);
  });

  it('returns 404 when user not found', async () => {
    db.query.mockResolvedValueOnce({ rows: [] });
    const res = await request(adminApp).put('/999').send(updateBody);
    expect(res.status).toBe(404);
  });

  it('returns 400 when patientId provided but patient not found', async () => {
    db.query
      .mockResolvedValueOnce({ rows: [{ id: 2 }] }) // user exists
      .mockResolvedValueOnce({ rows: [] });          // patient not found
    const res = await request(adminApp).put('/2').send({ ...updateBody, patientId: 99 });
    expect(res.status).toBe(400);
  });

  it('returns 200 on successful update', async () => {
    db.query
      .mockResolvedValueOnce({ rows: [{ id: 2 }] })                    // user exists
      .mockResolvedValueOnce({ rows: [{ id: 2, username: 'updated' }] }); // UPDATE
    const res = await request(adminApp).put('/2').send(updateBody);
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });

  it('returns 500 when DB throws', async () => {
    db.query.mockRejectedValue(new Error('DB error'));
    const res = await request(adminApp).put('/2').send(updateBody);
    expect(res.status).toBe(500);
  });
});

// ─── DELETE /:id (admin only) ─────────────────────────────────────────────

describe('DELETE /users/:id', () => {
  it('returns 403 for non-admin', async () => {
    const res = await request(userApp).delete('/2');
    expect(res.status).toBe(403);
  });

  it('returns 404 when user not found', async () => {
    db.query.mockResolvedValueOnce({ rows: [] });
    const res = await request(adminApp).delete('/99');
    expect(res.status).toBe(404);
  });

  it('returns 400 when trying to delete the last admin', async () => {
    db.query
      .mockResolvedValueOnce({ rows: [{ id: 1, role: 'admin' }] })  // user is admin
      .mockResolvedValueOnce({ rows: [{ count: '1' }] });            // only 1 admin left
    const res = await request(adminApp).delete('/1');
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/last admin/i);
  });

  it('returns 200 when deleting an admin user (not the last)', async () => {
    db.query
      .mockResolvedValueOnce({ rows: [{ id: 2, role: 'admin' }] }) // user is admin
      .mockResolvedValueOnce({ rows: [{ count: '2' }] })            // 2 admins exist
      .mockResolvedValueOnce({ rows: [] });                         // DELETE
    const res = await request(adminApp).delete('/2');
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });

  it('returns 200 when deleting a non-admin user', async () => {
    db.query
      .mockResolvedValueOnce({ rows: [{ id: 3, role: 'user' }] }) // user is non-admin
      .mockResolvedValueOnce({ rows: [] });                        // DELETE
    const res = await request(adminApp).delete('/3');
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });

  it('returns 500 when DB throws', async () => {
    db.query.mockRejectedValue(new Error('DB error'));
    const res = await request(adminApp).delete('/2');
    expect(res.status).toBe(500);
  });
});

// ─── PUT /:id/reset-password (admin only) ────────────────────────────────

describe('PUT /users/:id/reset-password', () => {
  it('returns 403 for non-admin', async () => {
    const res = await request(userApp).put('/2/reset-password').send({ newPassword: 'newpass123' });
    expect(res.status).toBe(403);
  });

  it('returns 400 when password is too short', async () => {
    const res = await request(adminApp).put('/2/reset-password').send({ newPassword: 'abc' });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/6 characters/i);
  });

  it('returns 404 when user not found', async () => {
    db.query.mockResolvedValueOnce({ rows: [] });
    const res = await request(adminApp).put('/99/reset-password').send({ newPassword: 'newpass123' });
    expect(res.status).toBe(404);
  });

  it('returns 200 on successful password reset', async () => {
    db.query
      .mockResolvedValueOnce({ rows: [{ id: 2 }] }) // user exists
      .mockResolvedValueOnce({ rows: [] });          // UPDATE
    const res = await request(adminApp).put('/2/reset-password').send({ newPassword: 'newpass123' });
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });

  it('returns 500 when DB throws', async () => {
    db.query.mockRejectedValue(new Error('DB error'));
    const res = await request(adminApp).put('/2/reset-password').send({ newPassword: 'newpass123' });
    expect(res.status).toBe(500);
  });
});
