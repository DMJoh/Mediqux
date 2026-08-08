const request = require('supertest');
const express = require('express');

// Mock DB and auth middleware before requiring the route module
jest.mock('../../src/database/db', () => ({ query: jest.fn(), getClient: jest.fn() }));
jest.mock('fs', () => ({
  promises: {
    unlink: jest.fn().mockResolvedValue(undefined),
    mkdir: jest.fn().mockResolvedValue(undefined),
    access: jest.fn().mockRejectedValue(new Error('File not found')),
  },
  existsSync: jest.fn().mockReturnValue(false),
  createReadStream: jest.fn(),
}));
jest.mock('multer', () => {
  const m = () => ({ single: () => (req, res, next) => next() });
  m.diskStorage = () => ({});
  return m;
});
jest.mock('../../src/middleware/auth', () => ({
  authenticateToken: (req, res, next) => { if (!req.user) req.user = { id: 1, role: 'admin', patientId: null }; next(); },
  addPatientFilter:  (req, res, next) => next(), // patientFilter is pre-set by app-level middleware
  requireAdmin:      (req, res, next) => next(),
  buildPatientFilter: jest.fn().mockReturnValue({ whereClause: '', params: [] }),
}));

const db = require('../../src/database/db');
const testResultsRouter = require('../../src/routes/test-results');

// Destructure exported pure functions
const {
  generatePdfFilename,
} = testResultsRouter;

// Admin app (patientFilter = null)
const app = express();
app.use(express.json());
app.use((req, res, next) => { req.user = { id: 1, role: 'admin', patientId: null }; req.patientFilter = null; next(); });
app.use('/', testResultsRouter);

// No-access app (patientFilter = 'none')
const noneApp = express();
noneApp.use(express.json());
noneApp.use((req, res, next) => { req.user = { id: 2, role: 'user', patientId: null }; req.patientFilter = 'none'; next(); });
noneApp.use('/', testResultsRouter);

// Filtered app (patientFilter = specific patient id)
const filteredApp = express();
filteredApp.use(express.json());
filteredApp.use((req, res, next) => { req.user = { id: 3, role: 'user', patientId: 5 }; req.patientFilter = 5; next(); });
filteredApp.use('/', testResultsRouter);

const fsModule = require('fs');

let mockClient;
beforeEach(() => {
  db.query.mockReset();
  mockClient = { query: jest.fn(), release: jest.fn() };
  db.getClient.mockResolvedValue(mockClient);
  fsModule.existsSync.mockReset();
  fsModule.existsSync.mockReturnValue(false);
  fsModule.createReadStream.mockReset();
  fsModule.promises.unlink.mockReset();
  fsModule.promises.unlink.mockResolvedValue(undefined);
  fsModule.promises.access.mockReset();
  fsModule.promises.access.mockRejectedValue(new Error('File not found'));
});

// ─── generatePdfFilename ───────────────────────────────────────────────────

describe('generatePdfFilename', () => {
  it('generates a clean filename from valid inputs', () => {
    const name = generatePdfFilename('CBC Panel', '2024-01-15', 'John', 'Doe');
    expect(name).toMatch(/^cbc_panel_2024-01-15_john_doe\.pdf$/);
  });

  it('sanitizes special characters in test name', () => {
    const name = generatePdfFilename('A&B Test!', '2024-06-01', 'Jane', 'Smith');
    expect(name).not.toMatch(/[^a-z0-9._-]/);
  });

  it('uses "unknown" when first and last name are both empty', () => {
    const name = generatePdfFilename('CBC', '2024-01-01', '', '');
    expect(name).toContain('unknown');
  });

  it('uses "lab_report" when testName is null', () => {
    const name = generatePdfFilename(null, '2024-01-01', 'A', 'B');
    expect(name).toContain('lab_report');
  });

  it('collapses multiple underscores into one', () => {
    const name = generatePdfFilename('Test  Name', '2024-01-01', 'A', 'B');
    expect(name).not.toContain('__');
  });
});

// ─── GET /panels route ─────────────────────────────────────────────────────

describe('GET /panels', () => {
  it('returns 200 with panels array on success', async () => {
    db.query.mockResolvedValueOnce({ rows: [{ id: 1, name: 'CBC', parameters: [] }] });
    const res = await request(app).get('/panels');
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
  });

  it('returns 500 when DB throws', async () => {
    db.query.mockRejectedValue(new Error('DB error'));
    const res = await request(app).get('/panels');
    expect(res.status).toBe(500);
    expect(res.body.success).toBe(false);
  });
});

// ─── GET /panels/:id ──────────────────────────────────────────────────────

describe('GET /panels/:id', () => {
  it('returns 200 with panel and parameters on success', async () => {
    db.query
      .mockResolvedValueOnce({ rows: [{ id: 1, name: 'CBC' }] })
      .mockResolvedValueOnce({ rows: [{ id: 10, parameter_name: 'Hemoglobin' }] });
    const res = await request(app).get('/panels/1');
    expect(res.status).toBe(200);
    expect(res.body.name).toBe('CBC');
    expect(res.body.parameters).toBeDefined();
  });

  it('returns 404 when panel does not exist', async () => {
    db.query.mockResolvedValueOnce({ rows: [] });
    const res = await request(app).get('/panels/999');
    expect(res.status).toBe(404);
    expect(res.body.success).toBe(false);
  });

  it('returns 500 when DB throws', async () => {
    db.query.mockRejectedValue(new Error('DB down'));
    const res = await request(app).get('/panels/1');
    expect(res.status).toBe(500);
  });
});

// ─── POST /panels ──────────────────────────────────────────────────────────

describe('POST /panels', () => {
  it('returns 400 when panel name is missing', async () => {
    const res = await request(app).post('/panels').send({ description: 'test' });
    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/name is required/i);
  });

  it('returns 400 when panel name already exists', async () => {
    db.query.mockResolvedValueOnce({ rows: [{ id: 1 }] }); // existing panel
    const res = await request(app).post('/panels').send({ name: 'CBC' });
    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/already exists/i);
  });

  it('returns 201 on successful panel creation', async () => {
    db.query
      .mockResolvedValueOnce({ rows: [] })                              // no duplicate
      .mockResolvedValueOnce({ rows: [] })                              // BEGIN
      .mockResolvedValueOnce({ rows: [{ id: 5, name: 'NewPanel' }] })  // INSERT panel
      .mockResolvedValueOnce({ rows: [] })                              // COMMIT
      .mockResolvedValueOnce({ rows: [{ id: 5, name: 'NewPanel', parameters: null }] }); // SELECT
    const res = await request(app).post('/panels').send({ name: 'NewPanel', parameters: [] });
    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
  });

  it('returns 201 on successful creation with parameters', async () => {
    db.query
      .mockResolvedValueOnce({ rows: [] })                              // no duplicate
      .mockResolvedValueOnce({ rows: [] })                              // BEGIN
      .mockResolvedValueOnce({ rows: [{ id: 5, name: 'CBC' }] })       // INSERT panel
      .mockResolvedValueOnce({ rows: [] })                              // INSERT parameter
      .mockResolvedValueOnce({ rows: [] })                              // COMMIT
      .mockResolvedValueOnce({ rows: [{ id: 5, name: 'CBC', parameters: null }] }); // SELECT
    const res = await request(app).post('/panels').send({
      name: 'CBC',
      parameters: [{ parameter_name: 'Hemoglobin', unit: 'g/dL', reference_min: 12, reference_max: 16 }],
    });
    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
  });

  it('returns 500 and rolls back when parameter insert fails', async () => {
    db.query
      .mockResolvedValueOnce({ rows: [] })                              // no duplicate
      .mockResolvedValueOnce({ rows: [] })                              // BEGIN
      .mockResolvedValueOnce({ rows: [{ id: 5, name: 'CBC' }] })       // INSERT panel
      .mockRejectedValueOnce(new Error('Insert failed'))                // parameter INSERT throws
      .mockResolvedValueOnce({ rows: [] });                             // ROLLBACK
    const res = await request(app).post('/panels').send({
      name: 'CBC',
      parameters: [{ parameter_name: 'HB' }],
    });
    expect(res.status).toBe(500);
  });

  it('returns 500 when DB throws', async () => {
    db.query.mockRejectedValue(new Error('DB down'));
    const res = await request(app).post('/panels').send({ name: 'Test' });
    expect(res.status).toBe(500);
  });
});

// ─── PUT /panels/:id ──────────────────────────────────────────────────────

describe('PUT /panels/:id', () => {
  it('returns 400 when name is missing', async () => {
    const res = await request(app).put('/panels/1').send({});
    expect(res.status).toBe(400);
  });

  it('returns 404 when panel does not exist', async () => {
    db.query.mockResolvedValueOnce({ rows: [] }); // panel not found
    const res = await request(app).put('/panels/99').send({ name: 'Updated' });
    expect(res.status).toBe(404);
  });

  it('returns 400 when new name conflicts with another panel', async () => {
    db.query
      .mockResolvedValueOnce({ rows: [{ id: 1 }] })    // panel exists
      .mockResolvedValueOnce({ rows: [{ id: 2 }] });   // name conflict
    const res = await request(app).put('/panels/1').send({ name: 'OtherPanel' });
    expect(res.status).toBe(400);
  });

  it('returns 200 on successful update', async () => {
    db.query
      .mockResolvedValueOnce({ rows: [{ id: 1 }] })   // panel exists
      .mockResolvedValueOnce({ rows: [] })             // no conflict
      .mockResolvedValueOnce({ rows: [{ id: 1, name: 'Updated' }] }); // UPDATE
    const res = await request(app).put('/panels/1').send({ name: 'Updated' });
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });

  it('returns 500 when DB throws', async () => {
    db.query.mockRejectedValue(new Error('DB error'));
    const res = await request(app).put('/panels/1').send({ name: 'Test' });
    expect(res.status).toBe(500);
  });
});

// ─── DELETE /panels/:id ───────────────────────────────────────────────────

describe('DELETE /panels/:id', () => {
  it('returns 404 when panel does not exist', async () => {
    db.query.mockResolvedValueOnce({ rows: [] });
    const res = await request(app).delete('/panels/99');
    expect(res.status).toBe(404);
  });

  it('returns 200 on successful deletion', async () => {
    db.query
      .mockResolvedValueOnce({ rows: [{ id: 1, name: 'CBC' }] }) // panel exists
      .mockResolvedValueOnce({ rows: [] })  // BEGIN
      .mockResolvedValueOnce({ rows: [] })  // DELETE params
      .mockResolvedValueOnce({ rows: [] })  // DELETE panel
      .mockResolvedValueOnce({ rows: [] }); // COMMIT
    const res = await request(app).delete('/panels/1');
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });

  it('rolls back and returns 500 when inner transaction fails', async () => {
    db.query
      .mockResolvedValueOnce({ rows: [{ id: 1, name: 'CBC' }] })    // panel exists
      .mockResolvedValueOnce({ rows: [] })                           // BEGIN
      .mockRejectedValueOnce(new Error('Delete params failed'))      // DELETE params throws
      .mockResolvedValueOnce({ rows: [] });                          // ROLLBACK
    const res = await request(app).delete('/panels/1');
    expect(res.status).toBe(500);
  });

  it('returns 500 when DB throws', async () => {
    db.query.mockRejectedValue(new Error('DB error'));
    const res = await request(app).delete('/panels/1');
    expect(res.status).toBe(500);
  });
});

// ─── POST /panels/:id/parameters ──────────────────────────────────────────

describe('POST /panels/:id/parameters', () => {
  it('returns 400 when parameter_name is missing', async () => {
    const res = await request(app).post('/panels/1/parameters').send({});
    expect(res.status).toBe(400);
  });

  it('returns 404 when panel does not exist', async () => {
    db.query.mockResolvedValueOnce({ rows: [] }); // panel not found
    const res = await request(app).post('/panels/99/parameters').send({ parameter_name: 'HB' });
    expect(res.status).toBe(404);
  });

  it('returns 400 when parameter already exists in panel', async () => {
    db.query
      .mockResolvedValueOnce({ rows: [{ id: 1 }] })   // panel exists
      .mockResolvedValueOnce({ rows: [{ id: 5 }] });  // param already exists
    const res = await request(app).post('/panels/1/parameters').send({ parameter_name: 'HB' });
    expect(res.status).toBe(400);
  });

  it('returns 201 on success', async () => {
    db.query
      .mockResolvedValueOnce({ rows: [{ id: 1 }] })   // panel exists
      .mockResolvedValueOnce({ rows: [] })             // no duplicate
      .mockResolvedValueOnce({ rows: [{ id: 10, parameter_name: 'Hemoglobin' }] }); // INSERT
    const res = await request(app).post('/panels/1/parameters').send({ parameter_name: 'Hemoglobin' });
    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
  });

  it('returns 500 when DB throws', async () => {
    db.query.mockRejectedValue(new Error('DB error'));
    const res = await request(app).post('/panels/1/parameters').send({ parameter_name: 'HB' });
    expect(res.status).toBe(500);
  });
});

// ─── PUT /panels/:panelId/parameters/:parameterId ─────────────────────────

describe('PUT /panels/:panelId/parameters/:parameterId', () => {
  it('returns 400 when parameter_name is missing', async () => {
    const res = await request(app).put('/panels/1/parameters/1').send({});
    expect(res.status).toBe(400);
  });

  it('returns 404 when parameter not found in panel', async () => {
    db.query.mockResolvedValueOnce({ rows: [] });
    const res = await request(app).put('/panels/1/parameters/99').send({ parameter_name: 'HB' });
    expect(res.status).toBe(404);
  });

  it('returns 400 when another parameter with same name exists in panel', async () => {
    db.query
      .mockResolvedValueOnce({ rows: [{ id: 1 }] })   // param exists
      .mockResolvedValueOnce({ rows: [{ id: 2 }] });  // duplicate found
    const res = await request(app).put('/panels/1/parameters/1').send({ parameter_name: 'Duplicate' });
    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/already exists/i);
  });

  it('returns 200 on successful parameter update', async () => {
    db.query
      .mockResolvedValueOnce({ rows: [{ id: 1 }] })   // param exists
      .mockResolvedValueOnce({ rows: [] })             // no name conflict
      .mockResolvedValueOnce({ rows: [{ id: 1, parameter_name: 'Updated' }] }); // UPDATE
    const res = await request(app).put('/panels/1/parameters/1').send({ parameter_name: 'Updated' });
    expect(res.status).toBe(200);
  });

  it('returns 500 when DB throws', async () => {
    db.query.mockRejectedValue(new Error('DB error'));
    const res = await request(app).put('/panels/1/parameters/1').send({ parameter_name: 'HB' });
    expect(res.status).toBe(500);
  });
});

// ─── DELETE /panels/:panelId/parameters/:parameterId ──────────────────────

describe('DELETE /panels/:panelId/parameters/:parameterId', () => {
  it('returns 404 when parameter not found', async () => {
    db.query.mockResolvedValueOnce({ rows: [] });
    const res = await request(app).delete('/panels/1/parameters/99');
    expect(res.status).toBe(404);
  });

  it('returns 200 on successful deletion', async () => {
    db.query
      .mockResolvedValueOnce({ rows: [{ id: 1, parameter_name: 'HB' }] })
      .mockResolvedValueOnce({ rows: [] }); // DELETE
    const res = await request(app).delete('/panels/1/parameters/1');
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });

  it('returns 500 when DB throws', async () => {
    db.query.mockRejectedValue(new Error('DB error'));
    const res = await request(app).delete('/panels/1/parameters/1');
    expect(res.status).toBe(500);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// Route handler tests (lines 946+)
// ═══════════════════════════════════════════════════════════════════════════

// ─── GET / (list test results) ────────────────────────────────────────────

describe('GET / (test results list)', () => {
  it('admin: returns all test results', async () => {
    db.query.mockResolvedValueOnce({ rows: [{ id: 1, test_name: 'CBC' }], rowCount: 1 });
    const res = await request(app).get('/');
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });

  it('user with no patient access returns empty array', async () => {
    const res = await request(noneApp).get('/');
    expect(res.status).toBe(200);
    expect(res.body.data).toEqual([]);
    expect(res.body.count).toBe(0);
  });

  it('supports search query parameter', async () => {
    db.query.mockResolvedValueOnce({ rows: [], rowCount: 0 });
    const res = await request(app).get('/').query({ search: 'cbc' });
    expect(res.status).toBe(200);
  });

  it('supports patient_id filter', async () => {
    db.query.mockResolvedValueOnce({ rows: [], rowCount: 0 });
    const res = await request(app).get('/').query({ patient_id: '5' });
    expect(res.status).toBe(200);
  });

  it('supports test_type filter', async () => {
    db.query.mockResolvedValueOnce({ rows: [], rowCount: 0 });
    const res = await request(app).get('/').query({ test_type: 'blood' });
    expect(res.status).toBe(200);
  });

  it('supports date_range filter', async () => {
    db.query.mockResolvedValueOnce({ rows: [], rowCount: 0 });
    const res = await request(app).get('/').query({ date_range: 'month' });
    expect(res.status).toBe(200);
  });

  it('user with patientId sees filtered results', async () => {
    db.query.mockResolvedValueOnce({ rows: [{ id: 1, test_name: 'CBC' }], rowCount: 1 });
    const res = await request(filteredApp).get('/');
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });

  it('returns 500 when DB throws', async () => {
    db.query.mockRejectedValue(new Error('DB error'));
    const res = await request(app).get('/');
    expect(res.status).toBe(500);
  });
});

// ─── GET /stats/summary (test results) ───────────────────────────────────

describe('GET /stats/summary (test results)', () => {
  it('returns empty stats when patientFilter is "none"', async () => {
    const res = await request(noneApp).get('/stats/summary');
    expect(res.status).toBe(200);
    expect(res.body.data.total_reports).toBe(0);
  });

  it('returns stats for admin', async () => {
    db.query.mockResolvedValueOnce({ rows: [{ total_reports: 10, unique_patients: 3, recent_reports: 2, abnormal_values: 1 }] });
    const res = await request(app).get('/stats/summary');
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });

  it('returns filtered stats for user with patientId', async () => {
    db.query.mockResolvedValueOnce({ rows: [{ total_reports: 2, unique_patients: 1, recent_reports: 1, abnormal_values: 0 }] });
    const res = await request(filteredApp).get('/stats/summary');
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });

  it('returns 500 when DB throws', async () => {
    db.query.mockRejectedValue(new Error('DB error'));
    const res = await request(app).get('/stats/summary');
    expect(res.status).toBe(500);
  });
});

// ─── GET /:id (single test result) ────────────────────────────────────────

describe('GET /:id (single test result)', () => {
  it('returns 200 with test result data', async () => {
    db.query.mockResolvedValueOnce({ rows: [{ id: 1, test_name: 'CBC', lab_values: [] }] });
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

// ─── GET /:id/lab-values ──────────────────────────────────────────────────

describe('GET /:id/lab-values', () => {
  it('returns 200 with lab values', async () => {
    db.query.mockResolvedValueOnce({ rows: [{ id: 1, parameter_name: 'Hemoglobin', value: 13.5 }] });
    const res = await request(app).get('/1/lab-values');
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.count).toBe(1);
  });

  it('returns 200 with empty array when no lab values', async () => {
    db.query.mockResolvedValueOnce({ rows: [] });
    const res = await request(app).get('/1/lab-values');
    expect(res.status).toBe(200);
    expect(res.body.data).toEqual([]);
  });

  it('returns 500 when DB throws', async () => {
    db.query.mockRejectedValue(new Error('DB error'));
    const res = await request(app).get('/1/lab-values');
    expect(res.status).toBe(500);
  });
});

// ─── GET /:id/download ────────────────────────────────────────────────────

describe('GET /:id/download', () => {
  it('returns 404 when test result not found', async () => {
    db.query.mockResolvedValueOnce({ rows: [] });
    const res = await request(app).get('/1/download');
    expect(res.status).toBe(404);
    expect(res.body.error).toMatch(/not found/i);
  });

  it('returns 404 when no PDF attached', async () => {
    db.query.mockResolvedValueOnce({ rows: [{ pdf_file_path: null, test_name: 'CBC', test_date: '2024-01-01', first_name: 'John', last_name: 'Doe' }] });
    const res = await request(app).get('/1/download');
    expect(res.status).toBe(404);
    expect(res.body.error).toMatch(/not available/i);
  });

  it('returns 404 when PDF file not found on server', async () => {
    db.query.mockResolvedValueOnce({ rows: [{ pdf_file_path: '/nonexistent/fake.pdf', test_name: 'CBC', test_date: '2024-01-01', first_name: 'John', last_name: 'Doe' }] });
    const res = await request(app).get('/1/download');
    expect(res.status).toBe(404);
    expect(res.body.error).toMatch(/not found on server/i);
  });

  it('streams the PDF file when it exists on disk', async () => {
    const { PassThrough } = require('stream');
    db.query.mockResolvedValueOnce({ rows: [{ pdf_file_path: '/fake/report.pdf', test_name: 'CBC', test_date: '2024-01-01', first_name: 'John', last_name: 'Doe' }] });
    fsModule.promises.access.mockResolvedValue(undefined); // file exists
    const mockStream = new PassThrough();
    fsModule.createReadStream.mockReturnValue(mockStream);
    const resPromise = request(app).get('/1/download');
    mockStream.end();
    await resPromise;
    expect(fsModule.createReadStream).toHaveBeenCalledWith('/fake/report.pdf');
  });

  it('returns 500 when DB throws', async () => {
    db.query.mockRejectedValue(new Error('DB error'));
    const res = await request(app).get('/1/download');
    expect(res.status).toBe(500);
  });
});

// ─── GET /:id/view ────────────────────────────────────────────────────────

describe('GET /:id/view', () => {
  it('returns 404 when test result or PDF not found', async () => {
    db.query.mockResolvedValueOnce({ rows: [] });
    const res = await request(app).get('/1/view');
    expect(res.status).toBe(404);
    expect(res.body.error).toMatch(/not found/i);
  });

  it('returns 404 when PDF file not found on server', async () => {
    db.query.mockResolvedValueOnce({ rows: [{ pdf_file_path: '/nonexistent/fake.pdf', test_name: 'CBC', test_date: '2024-01-01', first_name: 'John', last_name: 'Doe' }] });
    const res = await request(app).get('/1/view');
    expect(res.status).toBe(404);
    expect(res.body.error).toMatch(/not found on server/i);
  });

  it('streams the PDF file inline when it exists on disk', async () => {
    const { PassThrough } = require('stream');
    db.query.mockResolvedValueOnce({ rows: [{ pdf_file_path: '/fake/report.pdf', test_name: 'CBC', test_date: '2024-01-01', first_name: 'Jane', last_name: 'Smith' }] });
    fsModule.existsSync.mockReturnValue(true);
    const mockStream = new PassThrough();
    fsModule.createReadStream.mockReturnValue(mockStream);
    const resPromise = request(app).get('/1/view');
    mockStream.end();
    await resPromise;
    expect(fsModule.createReadStream).toHaveBeenCalledWith('/fake/report.pdf');
  });

  it('returns 500 when DB throws', async () => {
    db.query.mockRejectedValue(new Error('DB error'));
    const res = await request(app).get('/1/view');
    expect(res.status).toBe(500);
  });
});

// ─── POST / (create test result) ──────────────────────────────────────────

describe('POST / (create test result)', () => {
  const validBody = { patient_id: 5, test_name: 'CBC', test_type: 'blood', test_date: '2024-01-01' };

  it('returns 400 when required fields are missing', async () => {
    const res = await request(app).post('/').send({ patient_id: 5 });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/required/i);
  });

  it('returns 400 when patient not found', async () => {
    db.query.mockResolvedValueOnce({ rows: [] }); // patient check
    const res = await request(app).post('/').send(validBody);
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/patient not found/i);
  });

  it('returns 201 on successful creation without lab values', async () => {
    db.query.mockResolvedValueOnce({ rows: [{ id: 5 }] }); // patient check
    mockClient.query
      .mockResolvedValueOnce({ rows: [] })                           // BEGIN
      .mockResolvedValueOnce({ rows: [{ id: 10, test_name: 'CBC' }] }) // INSERT
      .mockResolvedValueOnce({ rows: [] });                          // COMMIT
    const res = await request(app).post('/').send(validBody);
    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(mockClient.release).toHaveBeenCalled();
  });

  it('returns 201 on successful creation with lab values', async () => {
    db.query.mockResolvedValueOnce({ rows: [{ id: 5 }] });
    mockClient.query
      .mockResolvedValueOnce({ rows: [] })                                 // BEGIN
      .mockResolvedValueOnce({ rows: [{ id: 10, test_name: 'CBC' }] })    // INSERT test result
      .mockResolvedValueOnce({ rows: [] })                                 // INSERT lab value
      .mockResolvedValueOnce({ rows: [] });                                // COMMIT
    const body = { ...validBody, lab_values: [{ parameter_name: 'Hemoglobin', value: 13.5, unit: 'g/dL', status: 'normal' }] };
    const res = await request(app).post('/').send(body);
    expect(res.status).toBe(201);
    expect(mockClient.release).toHaveBeenCalled();
  });

  it('returns 500 and rolls back when transaction fails', async () => {
    db.query.mockResolvedValueOnce({ rows: [{ id: 5 }] });
    mockClient.query
      .mockResolvedValueOnce({ rows: [] })             // BEGIN
      .mockRejectedValueOnce(new Error('Insert failed')); // INSERT throws
    const res = await request(app).post('/').send(validBody);
    expect(res.status).toBe(500);
    expect(mockClient.release).toHaveBeenCalled();
  });

  it('returns 500 when DB query throws', async () => {
    db.query.mockRejectedValue(new Error('DB error'));
    const res = await request(app).post('/').send(validBody);
    expect(res.status).toBe(500);
  });
});

// ─── POST /:id/lab-values ─────────────────────────────────────────────────

describe('POST /:id/lab-values', () => {
  it('returns 400 when lab_values is missing', async () => {
    const res = await request(app).post('/1/lab-values').send({});
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/required/i);
  });

  it('returns 400 when lab_values is empty array', async () => {
    const res = await request(app).post('/1/lab-values').send({ lab_values: [] });
    expect(res.status).toBe(400);
  });

  it('returns 404 when test result not found', async () => {
    db.query.mockResolvedValueOnce({ rows: [] }); // test result check
    const res = await request(app).post('/1/lab-values').send({ lab_values: [{ parameter_name: 'HB', value: 13.5 }] });
    expect(res.status).toBe(404);
  });

  it('returns 200 on successful save (skips values with invalid format)', async () => {
    db.query.mockResolvedValueOnce({ rows: [{ id: 1 }] }); // test result check
    mockClient.query
      .mockResolvedValueOnce({ rows: [] })  // BEGIN
      .mockResolvedValueOnce({ rows: [] })  // DELETE existing lab values
      .mockResolvedValueOnce({ rows: [] })  // INSERT lab value
      .mockResolvedValueOnce({ rows: [] }); // COMMIT
    const res = await request(app).post('/1/lab-values').send({
      lab_values: [
        { parameter_name: 'Hemoglobin', value: 13.5, unit: 'g/dL' },
        { parameter_name: '', value: null },                          // skipped: no name/value
        { parameter_name: 'BigNumber', value: 99999999 },             // skipped: value too large
      ],
    });
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(mockClient.release).toHaveBeenCalled();
  });

  it('returns 500 and rolls back on transaction error', async () => {
    db.query.mockResolvedValueOnce({ rows: [{ id: 1 }] });
    mockClient.query
      .mockResolvedValueOnce({ rows: [] })              // BEGIN
      .mockRejectedValueOnce(new Error('Delete failed')); // DELETE throws
    const res = await request(app).post('/1/lab-values').send({ lab_values: [{ parameter_name: 'HB', value: 12 }] });
    expect(res.status).toBe(500);
    expect(mockClient.release).toHaveBeenCalled();
  });
});

// ─── PUT /:id (update test result) ────────────────────────────────────────

describe('PUT /:id (update test result)', () => {
  it('returns 404 when test result not found', async () => {
    mockClient.query
      .mockResolvedValueOnce({ rows: [] })  // BEGIN
      .mockResolvedValueOnce({ rows: [] })  // UPDATE → not found
      .mockResolvedValueOnce({ rows: [] }); // ROLLBACK
    const res = await request(app).put('/999').send({ test_name: 'CBC' });
    expect(res.status).toBe(404);
    expect(mockClient.release).toHaveBeenCalled();
  });

  it('returns 200 on successful update without lab values', async () => {
    mockClient.query
      .mockResolvedValueOnce({ rows: [] })                             // BEGIN
      .mockResolvedValueOnce({ rows: [{ id: 1, test_name: 'CBC' }] }) // UPDATE
      .mockResolvedValueOnce({ rows: [] });                            // COMMIT
    const res = await request(app).put('/1').send({ test_name: 'CBC', test_type: 'blood', test_date: '2024-01-01' });
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(mockClient.release).toHaveBeenCalled();
  });

  it('returns 200 on successful update with lab values', async () => {
    mockClient.query
      .mockResolvedValueOnce({ rows: [] })                             // BEGIN
      .mockResolvedValueOnce({ rows: [{ id: 1, test_name: 'CBC' }] }) // UPDATE
      .mockResolvedValueOnce({ rows: [] })                             // DELETE existing lab values
      .mockResolvedValueOnce({ rows: [] })                             // INSERT lab value
      .mockResolvedValueOnce({ rows: [] });                            // COMMIT
    const res = await request(app).put('/1').send({
      test_name: 'CBC', test_type: 'blood', test_date: '2024-01-01',
      lab_values: [{ parameter_name: 'Hemoglobin', value: 14.0, unit: 'g/dL' }],
    });
    expect(res.status).toBe(200);
    expect(mockClient.release).toHaveBeenCalled();
  });

  it('returns 500 and rolls back on transaction error', async () => {
    mockClient.query
      .mockResolvedValueOnce({ rows: [] })               // BEGIN
      .mockRejectedValueOnce(new Error('Update failed')); // UPDATE throws
    const res = await request(app).put('/1').send({ test_name: 'CBC' });
    expect(res.status).toBe(500);
    expect(mockClient.release).toHaveBeenCalled();
  });
});

// ─── DELETE /:id (delete test result) ─────────────────────────────────────

describe('DELETE /:id (delete test result)', () => {
  it('returns 404 when not found', async () => {
    db.query
      .mockResolvedValueOnce({ rows: [] })  // SELECT pdf_file_path
      .mockResolvedValueOnce({ rows: [] }); // DELETE → not found
    const res = await request(app).delete('/999');
    expect(res.status).toBe(404);
  });

  it('returns 200 on successful deletion (no PDF file)', async () => {
    db.query
      .mockResolvedValueOnce({ rows: [{ pdf_file_path: null }] })    // SELECT pdf_file_path
      .mockResolvedValueOnce({ rows: [{ test_name: 'CBC', patient_id: 5 }] }); // DELETE RETURNING
    const res = await request(app).delete('/1');
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });

  it('returns 200 on successful deletion (PDF file cleanup attempted, file not found is ignored)', async () => {
    db.query
      .mockResolvedValueOnce({ rows: [{ pdf_file_path: '/nonexistent/path/file.pdf' }] })
      .mockResolvedValueOnce({ rows: [{ test_name: 'Blood Test', patient_id: 5 }] });
    const res = await request(app).delete('/1');
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });

  it('deletes PDF file when it is within the uploads directory', async () => {
    const path = require('path');
    const uploadsDir = path.resolve('./uploads');
    const pdfPath = path.join(uploadsDir, 'lab-reports/test.pdf');
    db.query
      .mockResolvedValueOnce({ rows: [{ pdf_file_path: pdfPath }] })
      .mockResolvedValueOnce({ rows: [{ test_name: 'CBC', patient_id: 5 }] });
    const res = await request(app).delete('/1');
    expect(res.status).toBe(200);
    expect(fsModule.promises.unlink).toHaveBeenCalledWith(pdfPath);
  });

  it('returns 500 when DB throws', async () => {
    db.query.mockRejectedValue(new Error('DB error'));
    const res = await request(app).delete('/1');
    expect(res.status).toBe(500);
  });
});

// ─── POST /upload ─────────────────────────────────────────────────────────

describe('POST /upload', () => {
  it('returns 400 when required fields are missing (no file)', async () => {
    // multer is mocked to not attach req.file, so pdfFile will be undefined
    const res = await request(app).post('/upload').send({ patientId: 5, testName: 'CBC', testType: 'blood', testDate: '2024-01-01' });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/required/i);
  });
});
