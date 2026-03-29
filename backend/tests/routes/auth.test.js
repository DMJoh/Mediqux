const request = require('supertest');
const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

jest.mock('../../src/database/db', () => ({ query: jest.fn() }));
const db = require('../../src/database/db');

// Build a minimal app for auth routes (no rate limiting, no global auth middleware)
const app = express();
app.use(express.json());
app.use('/api/auth', require('../../src/routes/auth'));

const JWT_SECRET = process.env.JWT_SECRET;

beforeEach(() => db.query.mockReset());

// ─── POST /api/auth/signup ─────────────────────────────────────────────────

describe('POST /api/auth/signup', () => {
  it('returns 400 when username or email already exists', async () => {
    db.query.mockResolvedValueOnce({ rows: [{ id: 1 }] }); // existing user check
    const res = await request(app)
      .post('/api/auth/signup')
      .send({ username: 'alice', email: 'alice@example.com', password: 'pass123', firstName: 'Alice', lastName: 'Smith' });
    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
    expect(res.body.error).toMatch(/already exists/i);
  });

  it('assigns admin role to the very first user', async () => {
    db.query
      .mockResolvedValueOnce({ rows: [] })                            // no existing user
      .mockResolvedValueOnce({ rows: [{ count: '0' }] })             // user count = 0
      .mockResolvedValueOnce({ rows: [{ id: 1, username: 'alice', email: 'alice@example.com', first_name: 'Alice', last_name: 'Smith', role: 'admin', created_at: new Date() }] }); // insert

    const res = await request(app)
      .post('/api/auth/signup')
      .send({ username: 'alice', email: 'alice@example.com', password: 'pass123', firstName: 'Alice', lastName: 'Smith' });
    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.user.role).toBe('admin');
    expect(res.body.data.token).toBeDefined();
  });

  it('assigns user role when other accounts already exist', async () => {
    db.query
      .mockResolvedValueOnce({ rows: [] })                             // no existing user
      .mockResolvedValueOnce({ rows: [{ count: '5' }] })              // user count > 0
      .mockResolvedValueOnce({ rows: [{ id: 2, username: 'bob', email: 'bob@example.com', first_name: 'Bob', last_name: 'Jones', role: 'user', created_at: new Date() }] });

    const res = await request(app)
      .post('/api/auth/signup')
      .send({ username: 'bob', email: 'bob@example.com', password: 'pass123', firstName: 'Bob', lastName: 'Jones' });
    expect(res.status).toBe(201);
    expect(res.body.data.user.role).toBe('user');
  });

  it('returns JWT token with correct payload on success', async () => {
    const createdAt = new Date();
    db.query
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [{ count: '1' }] })
      .mockResolvedValueOnce({ rows: [{ id: 10, username: 'carol', email: 'carol@example.com', first_name: 'Carol', last_name: 'White', role: 'user', created_at: createdAt }] });

    const res = await request(app)
      .post('/api/auth/signup')
      .send({ username: 'carol', email: 'carol@example.com', password: 'pass123', firstName: 'Carol', lastName: 'White' });
    expect(res.status).toBe(201);
    const decoded = jwt.verify(res.body.data.token, JWT_SECRET);
    expect(decoded.userId).toBe(10);
    expect(decoded.username).toBe('carol');
    expect(decoded.role).toBe('user');
  });

  it('returns 500 when the database throws', async () => {
    db.query.mockRejectedValue(new Error('DB down'));
    const res = await request(app)
      .post('/api/auth/signup')
      .send({ username: 'err', email: 'err@example.com', password: 'x', firstName: 'E', lastName: 'R' });
    expect(res.status).toBe(500);
    expect(res.body.success).toBe(false);
  });
});

// ─── POST /api/auth/login ──────────────────────────────────────────────────

describe('POST /api/auth/login', () => {
  it('returns 401 when username is not found', async () => {
    db.query.mockResolvedValueOnce({ rows: [] });
    const res = await request(app)
      .post('/api/auth/login')
      .send({ username: 'nobody', password: 'pass' });
    expect(res.status).toBe(401);
    expect(res.body.error).toMatch(/invalid credentials/i);
  });

  it('returns 401 when account is deactivated', async () => {
    db.query.mockResolvedValueOnce({ rows: [{ id: 1, is_active: false, password_hash: 'hash' }] });
    const res = await request(app)
      .post('/api/auth/login')
      .send({ username: 'alice', password: 'pass' });
    expect(res.status).toBe(401);
    expect(res.body.error).toMatch(/deactivated/i);
  });

  it('returns 401 when password is wrong', async () => {
    const hash = await bcrypt.hash('correctpass', 10);
    db.query.mockResolvedValueOnce({ rows: [{ id: 1, username: 'alice', email: 'a@a.com', password_hash: hash, first_name: 'Alice', last_name: 'S', role: 'user', is_active: true }] });
    const res = await request(app)
      .post('/api/auth/login')
      .send({ username: 'alice', password: 'wrongpass' });
    expect(res.status).toBe(401);
    expect(res.body.error).toMatch(/invalid credentials/i);
  });

  it('returns 200 with token on valid credentials', async () => {
    const hash = await bcrypt.hash('secret123', 10);
    db.query
      .mockResolvedValueOnce({ rows: [{ id: 5, username: 'alice', email: 'a@a.com', password_hash: hash, first_name: 'Alice', last_name: 'S', role: 'user', is_active: true }] })
      .mockResolvedValueOnce({ rows: [] }); // UPDATE last_login

    const res = await request(app)
      .post('/api/auth/login')
      .send({ username: 'alice', password: 'secret123' });
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.token).toBeDefined();
    const decoded = jwt.verify(res.body.data.token, JWT_SECRET);
    expect(decoded.userId).toBe(5);
  });

  it('returns correct user profile fields on login', async () => {
    const hash = await bcrypt.hash('pass', 10);
    db.query
      .mockResolvedValueOnce({ rows: [{ id: 3, username: 'bob', email: 'b@b.com', password_hash: hash, first_name: 'Bob', last_name: 'Jones', role: 'admin', is_active: true }] })
      .mockResolvedValueOnce({ rows: [] });

    const res = await request(app)
      .post('/api/auth/login')
      .send({ username: 'bob', password: 'pass' });
    expect(res.body.data.user).toMatchObject({
      id: 3,
      username: 'bob',
      email: 'b@b.com',
      firstName: 'Bob',
      lastName: 'Jones',
      role: 'admin',
    });
  });

  it('returns 500 when the database throws', async () => {
    db.query.mockRejectedValue(new Error('DB timeout'));
    const res = await request(app)
      .post('/api/auth/login')
      .send({ username: 'alice', password: 'pass' });
    expect(res.status).toBe(500);
  });
});

// ─── GET /api/auth/me ──────────────────────────────────────────────────────

describe('GET /api/auth/me', () => {
  it('returns 401 when no Authorization header', async () => {
    const res = await request(app).get('/api/auth/me');
    expect(res.status).toBe(401);
    expect(res.body.error).toMatch(/no token/i);
  });

  it('returns 401 when token is invalid', async () => {
    const res = await request(app)
      .get('/api/auth/me')
      .set('Authorization', 'Bearer totally.invalid.token');
    expect(res.status).toBe(401);
  });

  it('returns 404 when user in token does not exist in DB', async () => {
    const token = jwt.sign({ userId: 999, username: 'ghost', role: 'user' }, JWT_SECRET);
    db.query.mockResolvedValueOnce({ rows: [] });
    const res = await request(app)
      .get('/api/auth/me')
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(404);
    expect(res.body.error).toMatch(/not found/i);
  });

  it('returns 200 with user profile for valid token', async () => {
    const token = jwt.sign({ userId: 1, username: 'alice', role: 'user' }, JWT_SECRET);
    db.query.mockResolvedValueOnce({
      rows: [{ id: 1, username: 'alice', email: 'a@a.com', first_name: 'Alice', last_name: 'S', role: 'user', last_login: null }],
    });
    const res = await request(app)
      .get('/api/auth/me')
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.user.username).toBe('alice');
  });
});

// ─── PUT /api/auth/change-password ────────────────────────────────────────

describe('PUT /api/auth/change-password', () => {
  it('returns 401 when no token provided', async () => {
    const res = await request(app)
      .put('/api/auth/change-password')
      .send({ currentPassword: 'old', newPassword: 'new' });
    expect(res.status).toBe(401);
  });

  it('returns 404 when user does not exist', async () => {
    const token = jwt.sign({ userId: 99 }, JWT_SECRET);
    db.query.mockResolvedValueOnce({ rows: [] });
    const res = await request(app)
      .put('/api/auth/change-password')
      .set('Authorization', `Bearer ${token}`)
      .send({ currentPassword: 'old', newPassword: 'new' });
    expect(res.status).toBe(404);
  });

  it('returns 400 when current password is incorrect', async () => {
    const hash = await bcrypt.hash('realpassword', 10);
    const token = jwt.sign({ userId: 1 }, JWT_SECRET);
    db.query.mockResolvedValueOnce({ rows: [{ password_hash: hash }] });
    const res = await request(app)
      .put('/api/auth/change-password')
      .set('Authorization', `Bearer ${token}`)
      .send({ currentPassword: 'wrongpassword', newPassword: 'newpass123' });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/incorrect/i);
  });

  it('returns 200 and updates password on correct current password', async () => {
    const hash = await bcrypt.hash('currentpass', 10);
    const token = jwt.sign({ userId: 1 }, JWT_SECRET);
    db.query
      .mockResolvedValueOnce({ rows: [{ password_hash: hash }] })
      .mockResolvedValueOnce({ rows: [] }); // UPDATE

    const res = await request(app)
      .put('/api/auth/change-password')
      .set('Authorization', `Bearer ${token}`)
      .send({ currentPassword: 'currentpass', newPassword: 'newpass456' });
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });

  it('returns 500 when DB throws during password change', async () => {
    const token = jwt.sign({ userId: 1 }, JWT_SECRET);
    db.query.mockRejectedValue(new Error('DB error'));
    const res = await request(app)
      .put('/api/auth/change-password')
      .set('Authorization', `Bearer ${token}`)
      .send({ currentPassword: 'old', newPassword: 'new' });
    expect(res.status).toBe(500);
  });
});

// ─── GET /api/auth/initial-config ─────────────────────────────────────────

describe('GET /api/auth/initial-config', () => {
  it('returns hasUsers: false when no users exist', async () => {
    db.query.mockResolvedValueOnce({ rows: [{ user_count: '0' }] });
    const res = await request(app).get('/api/auth/initial-config');
    expect(res.status).toBe(200);
    expect(res.body.data.hasUsers).toBe(false);
    expect(res.body.data.userCount).toBe(0);
  });

  it('returns hasUsers: true when users exist', async () => {
    db.query.mockResolvedValueOnce({ rows: [{ user_count: '3' }] });
    const res = await request(app).get('/api/auth/initial-config');
    expect(res.status).toBe(200);
    expect(res.body.data.hasUsers).toBe(true);
    expect(res.body.data.userCount).toBe(3);
  });

  it('returns 500 when DB throws', async () => {
    db.query.mockRejectedValue(new Error('DB error'));
    const res = await request(app).get('/api/auth/initial-config');
    expect(res.status).toBe(500);
  });
});
