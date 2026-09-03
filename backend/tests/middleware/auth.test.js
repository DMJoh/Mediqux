const jwt = require('jsonwebtoken');

jest.mock('../../src/database/db', () => ({
  query: jest.fn(),
  getClient: jest.fn(),
  pool: { on: jest.fn() },
}));

const db = require('../../src/database/db');
const {
  authenticateToken,
  requireRole,
  requireAdmin,
  addPatientFilter,
  patientFilterClause,
  patientFilterAllows,
} = require('../../src/middleware/auth');

const JWT_SECRET = process.env.JWT_SECRET;

// Helper: build minimal mock req/res/next
function mockHttp(headers = {}) {
  const req = { headers, user: undefined };
  const res = {
    status: jest.fn().mockReturnThis(),
    json: jest.fn().mockReturnThis(),
  };
  const next = jest.fn();
  return { req, res, next };
}

// ─── authenticateToken ────────────────────────────────────────────────────────

describe('authenticateToken', () => {
  beforeEach(() => db.query.mockReset());

  it('returns 401 when Authorization header is absent', async () => {
    const { req, res, next } = mockHttp();
    await authenticateToken(req, res, next);
    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({ success: false, error: 'Access token required' });
    expect(next).not.toHaveBeenCalled();
  });

  it('returns 401 when Bearer token is missing from header', async () => {
    const { req, res, next } = mockHttp({ authorization: 'Bearer ' });
    await authenticateToken(req, res, next);
    expect(res.status).toHaveBeenCalledWith(401);
    expect(next).not.toHaveBeenCalled();
  });

  it('returns 403 for a completely invalid token string', async () => {
    const { req, res, next } = mockHttp({ authorization: 'Bearer not.a.real.token' });
    await authenticateToken(req, res, next);
    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.json).toHaveBeenCalledWith({ success: false, error: 'Invalid token' });
    expect(next).not.toHaveBeenCalled();
  });

  it('returns 403 with expired:true for an expired token', async () => {
    const expired = jwt.sign({ userId: 1, username: 'test', role: 'user' }, JWT_SECRET, { expiresIn: '-1s' });
    const { req, res, next } = mockHttp({ authorization: `Bearer ${expired}` });
    await authenticateToken(req, res, next);
    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.json).toHaveBeenCalledWith({ success: false, error: 'Token expired', expired: true });
    expect(next).not.toHaveBeenCalled();
  });

  it('returns 403 when token is signed with wrong secret', async () => {
    const wrong = jwt.sign({ userId: 1, username: 'test', role: 'user' }, 'wrong-secret');
    const { req, res, next } = mockHttp({ authorization: `Bearer ${wrong}` });
    await authenticateToken(req, res, next);
    expect(res.status).toHaveBeenCalledWith(403);
  });

  it('returns 401 when user does not exist in DB', async () => {
    const token = jwt.sign({ userId: 999, username: 'ghost', role: 'user' }, JWT_SECRET);
    const { req, res, next } = mockHttp({ authorization: `Bearer ${token}` });
    db.query.mockResolvedValue({ rows: [] });
    await authenticateToken(req, res, next);
    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({ success: false, error: 'Invalid or inactive user' });
  });

  it('returns 401 when user exists but is_active is false', async () => {
    const token = jwt.sign({ userId: 2, username: 'inactive', role: 'user' }, JWT_SECRET);
    const { req, res, next } = mockHttp({ authorization: `Bearer ${token}` });
    db.query.mockResolvedValue({ rows: [{ id: 2, is_active: false, patient_ids: [] }] });
    await authenticateToken(req, res, next);
    expect(res.status).toHaveBeenCalledWith(401);
  });

  it('populates req.user and calls next() for a valid active user', async () => {
    const token = jwt.sign({ userId: 1, username: 'admin', role: 'admin' }, JWT_SECRET);
    const { req, res, next } = mockHttp({ authorization: `Bearer ${token}` });
    db.query.mockResolvedValue({ rows: [{ id: 1, username: 'admin', role: 'admin', is_active: true, patient_ids: [5] }] });
    await authenticateToken(req, res, next);
    expect(next).toHaveBeenCalled();
    expect(req.user).toEqual({ id: 1, username: 'admin', role: 'admin', patientIds: [5] });
  });

  it('returns 403 when DB throws an unexpected error', async () => {
    const token = jwt.sign({ userId: 1, username: 'admin', role: 'admin' }, JWT_SECRET);
    const { req, res, next } = mockHttp({ authorization: `Bearer ${token}` });
    db.query.mockRejectedValue(new Error('DB connection refused'));
    await authenticateToken(req, res, next);
    expect(res.status).toHaveBeenCalledWith(403);
    expect(next).not.toHaveBeenCalled();
  });

  it('sets patientIds to an empty array when the user has no linked patients', async () => {
    const token = jwt.sign({ userId: 3, username: 'user3', role: 'user' }, JWT_SECRET);
    const { req, res, next } = mockHttp({ authorization: `Bearer ${token}` });
    db.query.mockResolvedValue({ rows: [{ id: 3, is_active: true, patient_ids: [] }] });
    await authenticateToken(req, res, next);
    expect(next).toHaveBeenCalled();
    expect(req.user.patientIds).toEqual([]);
  });
});

// ─── requireRole ─────────────────────────────────────────────────────────────

describe('requireRole', () => {
  it('returns 401 when req.user is undefined', () => {
    const { req, res, next } = mockHttp();
    requireRole(['admin'])(req, res, next);
    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({ success: false, error: 'Authentication required' });
    expect(next).not.toHaveBeenCalled();
  });

  it('returns 403 when user role is not in the allowed list', () => {
    const { req, res, next } = mockHttp();
    req.user = { id: 1, role: 'user' };
    requireRole(['admin'])(req, res, next);
    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.json).toHaveBeenCalledWith({ success: false, error: 'Insufficient permissions' });
    expect(next).not.toHaveBeenCalled();
  });

  it('calls next() when user role matches one of the allowed roles', () => {
    const { req, res, next } = mockHttp();
    req.user = { id: 1, role: 'admin' };
    requireRole(['admin', 'superuser'])(req, res, next);
    expect(next).toHaveBeenCalled();
    expect(res.status).not.toHaveBeenCalled();
  });

  it('allows access when user role matches the only allowed role', () => {
    const { req, res, next } = mockHttp();
    req.user = { id: 2, role: 'user' };
    requireRole(['user'])(req, res, next);
    expect(next).toHaveBeenCalled();
  });
});

// ─── requireAdmin ─────────────────────────────────────────────────────────────

describe('requireAdmin', () => {
  it('blocks non-admin users', () => {
    const { req, res, next } = mockHttp();
    req.user = { id: 1, role: 'user' };
    requireAdmin(req, res, next);
    expect(res.status).toHaveBeenCalledWith(403);
    expect(next).not.toHaveBeenCalled();
  });

  it('allows admin users through', () => {
    const { req, res, next } = mockHttp();
    req.user = { id: 1, role: 'admin' };
    requireAdmin(req, res, next);
    expect(next).toHaveBeenCalled();
  });
});

// ─── addPatientFilter ─────────────────────────────────────────────────────────

describe('addPatientFilter', () => {
  it('sets patientFilter to null for admin users (sees all data)', () => {
    const { req, res, next } = mockHttp();
    req.user = { id: 1, role: 'admin', patientIds: [] };
    addPatientFilter(req, res, next);
    expect(req.patientFilter).toBeNull();
    expect(next).toHaveBeenCalled();
  });

  it('sets patientFilter to the patientIds array for non-admin with linked patients', () => {
    const { req, res, next } = mockHttp();
    req.user = { id: 2, role: 'user', patientIds: [42, 7] };
    addPatientFilter(req, res, next);
    expect(req.patientFilter).toEqual([42, 7]);
    expect(next).toHaveBeenCalled();
  });

  it('sets patientFilter to "none" for non-admin with no linked patients', () => {
    const { req, res, next } = mockHttp();
    req.user = { id: 3, role: 'user', patientIds: [] };
    addPatientFilter(req, res, next);
    expect(req.patientFilter).toBe('none');
    expect(next).toHaveBeenCalled();
  });

  it('returns 401 when req.user is unset (middleware-ordering guard)', () => {
    const { req, res, next } = mockHttp();
    addPatientFilter(req, res, next);
    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({ success: false, error: 'Authentication required' });
    expect(next).not.toHaveBeenCalled();
  });
});

// ─── patientFilterClause ──────────────────────────────────────────────────────

describe('patientFilterClause', () => {
  it('returns an unrestricted clause and leaves params untouched when patientFilter is null (admin)', () => {
    const params = [];
    const result = patientFilterClause(null, 'patient_id', params);
    expect(result).toBe('1=1');
    expect(params).toEqual([]);
  });

  it('returns a never-matching clause and leaves params untouched when patientFilter is "none"', () => {
    const params = [];
    const result = patientFilterClause('none', 'patient_id', params);
    expect(result).toBe('1=0');
    expect(params).toEqual([]);
  });

  it('pushes the id array onto params and returns an ANY(...) clause for a scoped filter', () => {
    const params = [];
    const result = patientFilterClause([1, 2, 3], 'p.patient_id', params);
    expect(result).toBe('p.patient_id = ANY($1::uuid[])');
    expect(params).toEqual([[1, 2, 3]]);
  });

  it('indexes the placeholder after any params already pushed by the caller', () => {
    const params = ['existing'];
    const result = patientFilterClause([1], 'patient_id', params);
    expect(result).toBe('patient_id = ANY($2::uuid[])');
    expect(params).toEqual(['existing', [1]]);
  });
});

// ─── patientFilterAllows ──────────────────────────────────────────────────────

describe('patientFilterAllows', () => {
  it('allows any patient id when patientFilter is null (admin)', () => {
    expect(patientFilterAllows(null, 'anything')).toBe(true);
  });

  it('denies every patient id when patientFilter is "none"', () => {
    expect(patientFilterAllows('none', 'anything')).toBe(false);
  });

  it('allows a patient id present in the scoped array', () => {
    expect(patientFilterAllows(['a', 'b'], 'a')).toBe(true);
  });

  it('denies a patient id not present in the scoped array', () => {
    expect(patientFilterAllows(['a', 'b'], 'c')).toBe(false);
  });
});
