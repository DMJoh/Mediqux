const request = require('supertest');
const createApp = require('../helpers/createApp');

jest.mock('../../src/database/db', () => ({ query: jest.fn(), getClient: jest.fn() }));
jest.mock('multer', () => {
  const multer = () => ({
    // Tests opt into a simulated uploaded file by sending { __withFile: true }
    // in the JSON body (already parsed by express.json() before this runs).
    single: () => (req, res, next) => {
      if (req.body && req.body.__withFile) {
        delete req.body.__withFile;
        req.file = { path: 'uploads/diagnostic-studies/mock.pdf', originalname: 'mock.pdf', mimetype: 'application/pdf' };
      }
      next();
    },
  });
  multer.diskStorage = () => ({});
  return multer;
});
jest.mock('../../src/middleware/auth', () => {
  const actual = jest.requireActual('../../src/middleware/auth');
  return {
    ...actual,
    addPatientFilter: (req, res, next) => next(),
    authenticateToken: (req, res, next) => next(),
    requireAdmin: (req, res, next) => next(),
  };
});

jest.mock('node:fs', () => ({
  existsSync: jest.fn(),
  createReadStream: jest.fn(),
  promises: { mkdir: jest.fn().mockResolvedValue(undefined), unlink: jest.fn().mockResolvedValue(undefined) },
}));

const db = require('../../src/database/db');
const diagnosticStudiesRouter = require('../../src/routes/diagnostic-studies');

const adminApp    = createApp(diagnosticStudiesRouter, { role: 'admin' });
const noneApp     = createApp(diagnosticStudiesRouter, { role: 'user', patientId: null });
const filteredApp = createApp(diagnosticStudiesRouter, { role: 'user', patientId: 5 });

let mockClient;
beforeEach(() => {
  db.query.mockReset();
  mockClient = { query: jest.fn(), release: jest.fn() };
  db.getClient.mockResolvedValue(mockClient);
});

// ─── GET /stats/summary ───────────────────────────────────────────────────

describe('GET /diagnostic-studies/stats/summary', () => {
  it('returns empty stats when patientFilter is "none"', async () => {
    const res = await request(noneApp).get('/stats/summary');
    expect(res.status).toBe(200);
    expect(res.body.data.total_studies).toBe(0);
  });

  it('returns stats for admin', async () => {
    db.query.mockResolvedValueOnce({ rows: [{ total_studies: 12, this_month: 3, unique_patients: 4 }] });
    const res = await request(adminApp).get('/stats/summary');
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });

  it('returns filtered stats for user with patientId', async () => {
    db.query.mockResolvedValueOnce({ rows: [{ total_studies: 2, this_month: 1, unique_patients: 1 }] });
    const res = await request(filteredApp).get('/stats/summary');
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

describe('GET /diagnostic-studies', () => {
  it('returns empty array when patientFilter is "none"', async () => {
    const res = await request(noneApp).get('/');
    expect(res.status).toBe(200);
    expect(res.body.data).toEqual([]);
  });

  it('returns 200 with studies list', async () => {
    db.query.mockResolvedValueOnce({ rows: [{ id: 1, study_type: 'X-Ray' }], rowCount: 1 });
    const res = await request(adminApp).get('/');
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });

  it('returns 500 when DB throws', async () => {
    db.query.mockRejectedValue(new Error('DB error'));
    const res = await request(adminApp).get('/');
    expect(res.status).toBe(500);
  });
});

// ─── GET /:id ─────────────────────────────────────────────────────────────

describe('GET /diagnostic-studies/:id', () => {
  it('returns 200 with study data', async () => {
    db.query.mockResolvedValueOnce({ rows: [{ id: 1, study_type: 'MRI' }] });
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

// ─── GET / (with filters) ─────────────────────────────────────────────────

describe('GET /diagnostic-studies (filters)', () => {
  it('returns filtered results by search', async () => {
    db.query.mockResolvedValueOnce({ rows: [] });
    const res = await request(adminApp).get('/').query({ search: 'x-ray' });
    expect(res.status).toBe(200);
  });

  it('returns filtered results by study_type', async () => {
    db.query.mockResolvedValueOnce({ rows: [] });
    const res = await request(adminApp).get('/').query({ study_type: 'MRI' });
    expect(res.status).toBe(200);
  });

  it('admin can filter by patient_id', async () => {
    db.query.mockResolvedValueOnce({ rows: [] });
    const res = await request(adminApp).get('/').query({ patient_id: '5' });
    expect(res.status).toBe(200);
  });

  it('returns filtered results for user with patientId', async () => {
    db.query.mockResolvedValueOnce({ rows: [{ id: 1, study_type: 'CT Scan' }] });
    const res = await request(filteredApp).get('/');
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });
});

// ─── GET /:id (RBAC) ──────────────────────────────────────────────────────

describe('GET /diagnostic-studies/:id (RBAC)', () => {
  it('returns 403 when patientFilter is "none"', async () => {
    const res = await request(noneApp).get('/1');
    expect(res.status).toBe(403);
  });

  it('returns filtered result for user with patientId', async () => {
    db.query.mockResolvedValueOnce({ rows: [{ id: 1, study_type: 'MRI', patient_id: 5 }] });
    const res = await request(filteredApp).get('/1');
    expect(res.status).toBe(200);
  });
});

// ─── POST / ───────────────────────────────────────────────────────────────

describe('POST /diagnostic-studies', () => {
  it('returns 400 when required fields are missing', async () => {
    const res = await request(adminApp).post('/').send({ study_type: 'X-Ray' });
    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/required/i);
  });

  it('returns 403 when patientFilter is "none"', async () => {
    const res = await request(noneApp).post('/').send({ patient_id: 1, study_type: 'X-Ray', study_date: '2024-01-01' });
    expect(res.status).toBe(403);
  });

  it('returns 403 when user tries to create for another patient', async () => {
    // filteredApp has patientId: 5 but sends patient_id: 99
    const res = await request(filteredApp).post('/').send({ patient_id: 99, study_type: 'X-Ray', study_date: '2024-01-01' });
    expect(res.status).toBe(403);
  });

  it('returns 201 on successful creation', async () => {
    db.query.mockResolvedValueOnce({ rows: [{ id: 5, study_type: 'X-Ray', study_date: '2024-01-01' }] });
    const res = await request(adminApp).post('/').send({ patient_id: 1, study_type: 'X-Ray', study_date: '2024-01-01' });
    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
  });

  it('returns 500 when DB throws', async () => {
    db.query.mockRejectedValue(new Error('DB error'));
    const res = await request(adminApp).post('/').send({ patient_id: 1, study_type: 'X-Ray', study_date: '2024-01-01' });
    expect(res.status).toBe(500);
  });

  it('stores the attachment info when a file is uploaded', async () => {
    db.query.mockResolvedValueOnce({ rows: [{ id: 5, study_type: 'X-Ray', attachment_original_name: 'mock.pdf' }] });
    const res = await request(adminApp).post('/').send({ patient_id: 1, study_type: 'X-Ray', study_date: '2024-01-01', __withFile: true });
    expect(res.status).toBe(201);
    // attachment_path/original_name/mime_type are the 11th-13th bind params to the INSERT
    expect(db.query.mock.calls[0][1].slice(10, 13)).toEqual(['uploads/diagnostic-studies/mock.pdf', 'mock.pdf', 'application/pdf']);
  });
});

// ─── PUT /:id ─────────────────────────────────────────────────────────────

describe('PUT /diagnostic-studies/:id', () => {
  it('returns 403 when patientFilter is "none"', async () => {
    const res = await request(noneApp).put('/1').send({});
    expect(res.status).toBe(403);
  });

  it('returns 404 when not found', async () => {
    db.query.mockResolvedValueOnce({ rows: [] }); // SELECT existing
    const res = await request(adminApp).put('/999').send({ study_type: 'MRI', study_date: '2024-01-01', patient_id: 1 });
    expect(res.status).toBe(404);
  });

  it('returns 403 when user tries to update another patient\'s study', async () => {
    // filteredApp has patientId: 5, but study belongs to patient_id: 99
    db.query.mockResolvedValueOnce({ rows: [{ id: 1, patient_id: 99, attachment_path: null }] });
    const res = await request(filteredApp).put('/1').send({ study_type: 'MRI', study_date: '2024-01-01', patient_id: 99 });
    expect(res.status).toBe(403);
  });

  it('returns 200 on successful update', async () => {
    db.query
      .mockResolvedValueOnce({ rows: [{ id: 1, patient_id: 1, attachment_path: null, attachment_original_name: null, attachment_mime_type: null }] })
      .mockResolvedValueOnce({ rows: [{ id: 1, study_type: 'MRI' }] }); // UPDATE
    const res = await request(adminApp).put('/1').send({ study_type: 'MRI', study_date: '2024-01-01', patient_id: 1 });
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });

  // filteredApp owns this study (patient_id: 5), but tries to reassign it onto
  // another patient via the request body's patient_id — without validating
  // the new value, this would let them plant attacker-controlled
  // findings/conclusion into that patient's record.
  it('returns 403 when a scoped user tries to reassign their study onto another patient', async () => {
    db.query.mockResolvedValueOnce({ rows: [{ id: 1, patient_id: 5, attachment_path: null }] }); // ownership check
    const res = await request(filteredApp).put('/1').send({ study_type: 'MRI', study_date: '2024-01-01', patient_id: 99 });
    expect(res.status).toBe(403);
    expect(db.query).toHaveBeenCalledTimes(1);
  });

  it('returns 500 when DB throws', async () => {
    db.query.mockRejectedValue(new Error('DB error'));
    const res = await request(adminApp).put('/1').send({});
    expect(res.status).toBe(500);
  });

  it('replaces the attachment and deletes the old file when a new one is uploaded', async () => {
    const fsNode = require('node:fs');
    db.query
      .mockResolvedValueOnce({ rows: [{ id: 1, patient_id: 1, attachment_path: 'uploads/diagnostic-studies/old.pdf', attachment_original_name: 'old.pdf', attachment_mime_type: 'application/pdf' }] })
      .mockResolvedValueOnce({ rows: [{ id: 1, study_type: 'MRI' }] }); // UPDATE
    const res = await request(adminApp).put('/1').send({ study_type: 'MRI', study_date: '2024-01-01', patient_id: 1, __withFile: true });
    expect(res.status).toBe(200);
    expect(fsNode.promises.unlink).toHaveBeenCalled();
    // attachment_path/original_name/mime_type are the 11th-13th bind params to the UPDATE
    const updateParams = db.query.mock.calls[1][1];
    expect(updateParams.slice(10, 13)).toEqual(['uploads/diagnostic-studies/mock.pdf', 'mock.pdf', 'application/pdf']);
  });
});

// ─── DELETE /:id ──────────────────────────────────────────────────────────

describe('DELETE /diagnostic-studies/:id', () => {
  it('returns 403 when patientFilter is "none"', async () => {
    const res = await request(noneApp).delete('/1');
    expect(res.status).toBe(403);
  });

  it('returns 404 when not found', async () => {
    db.query.mockResolvedValueOnce({ rows: [] });
    const res = await request(adminApp).delete('/999');
    expect(res.status).toBe(404);
  });

  it('returns 403 when user tries to delete another patient\'s study', async () => {
    db.query.mockResolvedValueOnce({ rows: [{ attachment_path: null, patient_id: 99 }] });
    const res = await request(filteredApp).delete('/1');
    expect(res.status).toBe(403);
  });

  it('returns 200 on successful deletion (no attachment)', async () => {
    db.query
      .mockResolvedValueOnce({ rows: [{ attachment_path: null, patient_id: 1 }] })
      .mockResolvedValueOnce({ rows: [] }); // DELETE
    const res = await request(adminApp).delete('/1');
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });

  it('returns 200 on successful deletion and attempts file cleanup', async () => {
    const fsNode = require('node:fs');
    fsNode.promises.unlink.mockResolvedValue(undefined);
    db.query
      .mockResolvedValueOnce({ rows: [{ attachment_path: '/uploads/study.pdf', patient_id: 1 }] })
      .mockResolvedValueOnce({ rows: [] }); // DELETE
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

// ─── GET /:id/view ────────────────────────────────────────────────────────

describe('GET /diagnostic-studies/:id/view', () => {
  let fsSync;
  beforeAll(() => { fsSync = require('node:fs'); });
  beforeEach(() => {
    fsSync.existsSync.mockReset();
    fsSync.createReadStream.mockReset();
  });

  it('returns 404 when study or attachment not found', async () => {
    db.query.mockResolvedValueOnce({ rows: [] });
    const res = await request(adminApp).get('/1/view');
    expect(res.status).toBe(404);
    expect(res.body.error).toMatch(/not found/i);
  });

  it('returns 404 when attachment file does not exist on disk', async () => {
    db.query.mockResolvedValueOnce({ rows: [{ attachment_path: '/uploads/study.pdf', attachment_mime_type: 'application/pdf', attachment_original_name: 'study.pdf', study_type: 'X-Ray', study_date: '2024-01-01', first_name: 'John', last_name: 'Doe' }] });
    fsSync.existsSync.mockReturnValue(false);
    const res = await request(adminApp).get('/1/view');
    expect(res.status).toBe(404);
    expect(res.body.error).toMatch(/not found on server/i);
  });

  it('streams the file when attachment exists on disk', async () => {
    const { PassThrough } = require('stream');
    db.query.mockResolvedValueOnce({ rows: [{ attachment_path: '/uploads/study.pdf', attachment_mime_type: 'application/pdf', attachment_original_name: 'study.pdf', study_type: 'X-Ray', study_date: '2024-01-01', first_name: 'John', last_name: 'Doe' }] });
    fsSync.existsSync.mockReturnValue(true);
    const mockStream = new PassThrough();
    fsSync.createReadStream.mockReturnValue(mockStream);
    const resPromise = request(adminApp).get('/1/view');
    mockStream.end(); // end the stream so supertest gets a response
    await resPromise;
    expect(fsSync.createReadStream).toHaveBeenCalledWith('/uploads/study.pdf');
  });

  it('returns 500 when DB throws', async () => {
    db.query.mockRejectedValue(new Error('DB error'));
    const res = await request(adminApp).get('/1/view');
    expect(res.status).toBe(500);
  });

  // addPatientFilter was applied to this route but never actually checked, so
  // any authenticated user could stream another patient's attachment by id.
  it("returns 404 (not 200) when the study belongs to a patient the caller can't access", async () => {
    db.query.mockResolvedValueOnce({ rows: [{ attachment_path: '/uploads/study.pdf', attachment_mime_type: 'application/pdf', attachment_original_name: 'study.pdf', study_type: 'X-Ray', study_date: '2024-01-01', patient_id: 9, first_name: 'John', last_name: 'Doe' }] });
    const res = await request(filteredApp).get('/1/view');
    expect(res.status).toBe(404);
    expect(fsSync.createReadStream).not.toHaveBeenCalled();
  });

  it('streams the file for a user scoped to the owning patient', async () => {
    const { PassThrough } = require('stream');
    db.query.mockResolvedValueOnce({ rows: [{ attachment_path: '/uploads/study.pdf', attachment_mime_type: 'application/pdf', attachment_original_name: 'study.pdf', study_type: 'X-Ray', study_date: '2024-01-01', patient_id: 5, first_name: 'John', last_name: 'Doe' }] });
    fsSync.existsSync.mockReturnValue(true);
    const mockStream = new PassThrough();
    fsSync.createReadStream.mockReturnValue(mockStream);
    const resPromise = request(filteredApp).get('/1/view');
    mockStream.end();
    const res = await resPromise;
    expect(res.status).toBe(200);
  });

  it('returns 404 for a user with no patient access', async () => {
    db.query.mockResolvedValueOnce({ rows: [{ attachment_path: '/uploads/study.pdf', attachment_mime_type: 'application/pdf', attachment_original_name: 'study.pdf', study_type: 'X-Ray', study_date: '2024-01-01', patient_id: 5, first_name: 'John', last_name: 'Doe' }] });
    const res = await request(noneApp).get('/1/view');
    expect(res.status).toBe(404);
  });
});
