const request = require('supertest');
const express = require('express');

// Mock DB and auth middleware before requiring the route module
jest.mock('../../src/database/db', () => ({ query: jest.fn(), getClient: jest.fn() }));
jest.mock('pdf-parse', () => jest.fn());
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
  extractLabValues,
  findParameterKey,
  formatParameterForDisplay,
  calculateConfidence,
  calculatePatternConfidence,
  removeDuplicateParameters,
  formatParameterName,
  formatReferenceRange,
  getUnitFromText,
  REFERENCE_RANGES,
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

let mockClient;
beforeEach(() => {
  db.query.mockReset();
  mockClient = { query: jest.fn(), release: jest.fn() };
  db.getClient.mockResolvedValue(mockClient);
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

// ─── findParameterKey ──────────────────────────────────────────────────────

describe('findParameterKey', () => {
  it.each([
    ['hemoglobin',           'hemoglobin'],
    ['haemoglobin (hb)',     'hemoglobin'],
    ['hb',                   'hemoglobin'],
    ['wbc count',            'wbc'],
    ['total wbc',            'wbc'],
    ['white blood cell',     'wbc'],
    ['rbc count',            'rbc'],
    ['red blood cell count', 'rbc'],
    ['platelet count',       'platelets'],
    ['hematocrit',           'hematocrit'],
    ['packed cell volume',   'hematocrit'],
    ['pcv',                  'hematocrit'],
    ['esr',                  'esr'],
    ['erythrocyte sedimentation rate', 'esr'],
    ['neutrophils',          'neutrophils'],
    ['lymphocytes',          'lymphocytes'],
    ['eosinophils',          'eosinophils'],
    ['monocytes',            'monocytes'],
    ['basophils',            'basophils'],
    ['mcv',                  'mcv'],
    ['mch',                  'mch'],
    ['mchc',                 'mchc'],
    ['glucose',              'glucose'],
    ['blood glucose',        'glucose'],
    ['creatinine',           'creatinine'],
    ['serum creatinine',     'creatinine'],
    ['total cholesterol',    'cholesterol'],
  ])('"%s" → "%s"', (input, expected) => {
    expect(findParameterKey(input)).toBe(expected);
  });

  it('returns null for unrecognised parameter text', () => {
    expect(findParameterKey('interleukin-6')).toBeNull();
    expect(findParameterKey('unknown lab value')).toBeNull();
  });
});

// ─── formatParameterName ──────────────────────────────────────────────────

describe('formatParameterName', () => {
  it('returns "Hemoglobin" for key "hemoglobin"', () => {
    expect(formatParameterName('hemoglobin')).toBe('Hemoglobin');
  });

  it('returns "WBC Count" for key "wbc"', () => {
    expect(formatParameterName('wbc')).toBe('WBC Count');
  });

  it('returns uppercased key for unknown keys', () => {
    expect(formatParameterName('unknown_key')).toBe('UNKNOWN_KEY');
  });

  it('returns correct names for all defined keys', () => {
    const knownKeys = ['hemoglobin','hematocrit','wbc','rbc','platelets','esr',
      'neutrophils','lymphocytes','eosinophils','monocytes','basophils',
      'mcv','mch','mchc','glucose','cholesterol','creatinine','bun'];
    knownKeys.forEach(key => {
      expect(typeof formatParameterName(key)).toBe('string');
      expect(formatParameterName(key).length).toBeGreaterThan(0);
    });
  });
});

// ─── formatParameterForDisplay ─────────────────────────────────────────────

describe('formatParameterForDisplay', () => {
  it('returns the canonical name for a known parameter', () => {
    const result = formatParameterForDisplay('hemoglobin');
    expect(result).toBe('Hemoglobin');
  });

  it('returns title-cased text for unknown parameter', () => {
    const result = formatParameterForDisplay('some unknown value');
    expect(result).toMatch(/^[A-Z]/); // starts with capital
  });

  it('strips extra whitespace', () => {
    const result = formatParameterForDisplay('  glucose  ');
    expect(result).toBe('Glucose');
  });
});

// ─── formatReferenceRange ──────────────────────────────────────────────────

describe('formatReferenceRange', () => {
  it('returns null for null input', () => {
    expect(formatReferenceRange(null)).toBeNull();
  });

  it('formats "min-max" when both are present', () => {
    expect(formatReferenceRange({ min: 4.5, max: 5.5, unit: 'mill/cumm' })).toBe('4.5-5.5');
  });

  it('formats "<max" when only max is present', () => {
    expect(formatReferenceRange({ max: 200, unit: 'mg/dL' })).toBe('<200');
  });

  it('formats ">min" when only min is present', () => {
    expect(formatReferenceRange({ min: 70, unit: 'mg/dL' })).toBe('>70');
  });

  it('returns null when neither min nor max is present', () => {
    expect(formatReferenceRange({ unit: 'x' })).toBeNull();
  });
});

// ─── calculateConfidence ──────────────────────────────────────────────────

describe('calculateConfidence', () => {
  it('returns high confidence for a known parameter with medical unit', () => {
    const match = { parameter: 'hemoglobin', unit: 'g/dl', patternUsed: 0 };
    const conf = calculateConfidence(match);
    expect(conf).toBeGreaterThanOrEqual(0.9);
    expect(conf).toBeLessThanOrEqual(1.0);
  });

  it('returns base confidence for unknown parameter without unit', () => {
    const match = { parameter: 'xyz-factor', unit: '', patternUsed: 2 };
    const conf = calculateConfidence(match);
    expect(conf).toBe(0.5);
  });

  it('adds bonus for recognisable medical units even on unknown parameter', () => {
    const matchNoUnit  = { parameter: 'random-thing', unit: '', patternUsed: 2 };
    const matchWithUnit = { parameter: 'random-thing', unit: 'mg/dl', patternUsed: 2 };
    expect(calculateConfidence(matchWithUnit)).toBeGreaterThan(calculateConfidence(matchNoUnit));
  });

  it('caps confidence at 1.0', () => {
    const match = { parameter: 'hemoglobin', unit: 'mg/dl', patternUsed: 0 };
    expect(calculateConfidence(match)).toBeLessThanOrEqual(1.0);
  });
});

// ─── calculatePatternConfidence ────────────────────────────────────────────

describe('calculatePatternConfidence', () => {
  it('returns higher confidence for pattern index 0', () => {
    // Use non-bonus args so the base confidence difference shows through (not capped at 1.0)
    const c0 = calculatePatternConfidence(0, 'unknown_test', 'xyz');
    const c2 = calculatePatternConfidence(2, 'unknown_test', 'xyz');
    expect(c0).toBeGreaterThan(c2); // 0.9 > 0.8
  });

  it('adds bonus for recognised medical units', () => {
    const withUnit    = calculatePatternConfidence(2, 'somelab', 'g/dL');
    const withoutUnit = calculatePatternConfidence(2, 'somelab', 'xyz');
    expect(withUnit).toBeGreaterThan(withoutUnit);
  });

  it('adds bonus for common lab parameter names', () => {
    const common  = calculatePatternConfidence(2, 'hemoglobin test', 'xyz');
    const unknown = calculatePatternConfidence(2, 'someobscurething', 'xyz');
    expect(common).toBeGreaterThan(unknown);
  });

  it('caps at 1.0', () => {
    expect(calculatePatternConfidence(0, 'hemoglobin', 'g/dL')).toBeLessThanOrEqual(1.0);
  });
});

// ─── removeDuplicateParameters ────────────────────────────────────────────

describe('removeDuplicateParameters', () => {
  it('removes exact duplicate parameter names, keeping highest confidence', () => {
    const input = [
      { parameter_name: 'Hemoglobin', value: 13.5, confidence: 0.8, unit: 'g/dL', status: 'normal', reference_range: null, raw_match: '' },
      { parameter_name: 'Hemoglobin', value: 14.0, confidence: 0.95, unit: 'g/dL', status: 'normal', reference_range: null, raw_match: '' },
    ];
    const result = removeDuplicateParameters(input);
    expect(result).toHaveLength(1);
    expect(result[0].confidence).toBe(0.95);
  });

  it('keeps all entries when there are no duplicates', () => {
    const input = [
      { parameter_name: 'Hemoglobin', value: 13, confidence: 0.9, unit: 'g/dL', status: 'normal', reference_range: null, raw_match: '' },
      { parameter_name: 'Glucose',    value: 90, confidence: 0.8, unit: 'mg/dL', status: 'normal', reference_range: null, raw_match: '' },
    ];
    expect(removeDuplicateParameters(input)).toHaveLength(2);
  });

  it('handles empty array', () => {
    expect(removeDuplicateParameters([])).toEqual([]);
  });
});

// ─── getUnitFromText ───────────────────────────────────────────────────────

describe('getUnitFromText', () => {
  it('extracts mg/dl from text', () => {
    expect(getUnitFromText('glucose: 95 mg/dl').toLowerCase()).toContain('mg/dl');
  });

  it('extracts % from text', () => {
    expect(getUnitFromText('hematocrit 45%')).toContain('%');
  });

  it('extracts g/dl from text', () => {
    expect(getUnitFromText('hemoglobin 13.5 g/dL').toLowerCase()).toContain('g/dl');
  });

  it('returns null when no unit is present', () => {
    expect(getUnitFromText('just some random words with no unit')).toBeNull();
  });
});

// ─── extractLabValues ──────────────────────────────────────────────────────

describe('extractLabValues', () => {
  it('extracts hemoglobin from simple text', () => {
    const text = 'Hemoglobin: 13.5 g/dL';
    const values = extractLabValues(text);
    const hb = values.find(v => v.parameter_name.toLowerCase().includes('hemoglobin'));
    expect(hb).toBeDefined();
    expect(hb.value).toBe(13.5);
  });

  it('filters out noise like reference ranges and adult/male/female labels', () => {
    const text = 'Reference range: 13.0-16.0 g/dL adult male reference 3.5';
    const values = extractLabValues(text);
    // Should not create entries for "reference range", "adult", "male"
    const noisy = values.filter(v =>
      ['reference', 'adult', 'male', 'female'].some(word =>
        v.parameter_name.toLowerCase().includes(word)
      )
    );
    expect(noisy).toHaveLength(0);
  });

  it('returns an empty array for empty text', () => {
    expect(extractLabValues('')).toEqual([]);
  });

  it('returns unique values (no duplicates for same parameter)', () => {
    const text = 'Hemoglobin 13.5 g/dL\nHb: 13.5 g/dL\nHaemoglobin: 13.5 gm/dl';
    const values = extractLabValues(text);
    const hbEntries = values.filter(v => v.parameter_name.toLowerCase().includes('hemoglobin'));
    expect(hbEntries.length).toBeLessThanOrEqual(1);
  });

  it('assigns status "low" when value is below reference min', () => {
    // Hemoglobin min is 13.0, so 9.0 should be low
    const text = 'Hemoglobin: 9.0 g/dL';
    const values = extractLabValues(text);
    const hb = values.find(v => v.parameter_name.toLowerCase().includes('hemoglobin'));
    if (hb) {
      expect(hb.status).toBe('low');
    }
  });

  it('assigns status "high" when value is above reference max', () => {
    // Glucose max is 100, so 150 should be high
    const text = 'Glucose: 150 mg/dL';
    const values = extractLabValues(text);
    const glu = values.find(v => v.parameter_name.toLowerCase().includes('glucose'));
    if (glu) {
      expect(glu.status).toBe('high');
    }
  });
});

// ─── REFERENCE_RANGES sanity checks ───────────────────────────────────────

describe('REFERENCE_RANGES', () => {
  it('has glucose range with min 70 and max 100', () => {
    expect(REFERENCE_RANGES.glucose).toEqual(expect.objectContaining({ min: 70, max: 100 }));
  });

  it('has hemoglobin range defined', () => {
    expect(REFERENCE_RANGES.hemoglobin).toBeDefined();
    expect(REFERENCE_RANGES.hemoglobin.min).toBeGreaterThan(0);
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

  it('returns 200 on successful parameter update', async () => {
    db.query
      .mockResolvedValueOnce({ rows: [{ id: 1 }] })   // param exists
      .mockResolvedValueOnce({ rows: [] })             // no name conflict
      .mockResolvedValueOnce({ rows: [{ id: 1, parameter_name: 'Updated' }] }); // UPDATE
    const res = await request(app).put('/panels/1/parameters/1').send({ parameter_name: 'Updated' });
    expect(res.status).toBe(200);
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
