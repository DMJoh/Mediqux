// We test the real Logger class — not a mock
// Spy on console methods to verify calls without polluting test output

const Logger = (() => {
  // Re-require so we get a fresh instance per test suite
  jest.resetModules();
  return require('../../src/utils/logger').constructor;
})();

// Re-import the singleton for tests that just need it working
const logger = require('../../src/utils/logger');

describe('Logger', () => {
  let consoleSpy = {};

  beforeEach(() => {
    consoleSpy.error = jest.spyOn(console, 'error').mockImplementation(() => {});
    consoleSpy.warn  = jest.spyOn(console, 'warn').mockImplementation(() => {});
    consoleSpy.log   = jest.spyOn(console, 'log').mockImplementation(() => {});
    consoleSpy.debug = jest.spyOn(console, 'debug').mockImplementation(() => {});
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  // ─── formatMessage ──────────────────────────────────────────────────────

  describe('formatMessage', () => {
    it('returns a valid JSON string', () => {
      const raw = logger.formatMessage('INFO', 'test message', { extra: 'data' });
      expect(() => JSON.parse(raw)).not.toThrow();
    });

    it('includes timestamp, level, message, and meta fields', () => {
      const raw = logger.formatMessage('ERROR', 'something broke', { code: 500 });
      const parsed = JSON.parse(raw);
      expect(parsed).toMatchObject({
        level: 'ERROR',
        message: 'something broke',
        code: 500,
      });
      expect(parsed.timestamp).toBeDefined();
    });

    it('works with no meta argument', () => {
      const raw = logger.formatMessage('WARN', 'heads up');
      const parsed = JSON.parse(raw);
      expect(parsed.message).toBe('heads up');
    });
  });

  // ─── shouldLog ─────────────────────────────────────────────────────────

  describe('shouldLog', () => {
    it('always logs ERROR level', () => {
      expect(logger.shouldLog('ERROR')).toBe(true);
    });

    it('respects the configured log level — does not log DEBUG at INFO level', () => {
      // Default in tests is LOG_LEVEL=ERROR (set in setup.js), so INFO=2 > 0=ERROR
      expect(logger.shouldLog('DEBUG')).toBe(false);
    });
  });

  // ─── log level routing ──────────────────────────────────────────────────

  describe('log', () => {
    it('uses console.error for ERROR level', () => {
      logger.error('boom', { detail: 'x' });
      expect(consoleSpy.error).toHaveBeenCalled();
      const arg = consoleSpy.error.mock.calls[0][0];
      expect(JSON.parse(arg).level).toBe('ERROR');
    });

    it('does not call console.warn for WARN when level is ERROR-only', () => {
      // In test env LOG_LEVEL=ERROR, WARN (1) > ERROR (0) so it should NOT log
      logger.warn('warning message');
      expect(consoleSpy.warn).not.toHaveBeenCalled();
    });

    it('does not call console.log for INFO when level is ERROR-only', () => {
      logger.info('info message');
      expect(consoleSpy.log).not.toHaveBeenCalled();
    });

    it('does not call console.debug for DEBUG when debugMode is off', () => {
      logger.debug('debug message');
      expect(consoleSpy.debug).not.toHaveBeenCalled();
    });
  });

  // ─── query ─────────────────────────────────────────────────────────────

  describe('query', () => {
    it('does not log when queryLogging is disabled (default in test env)', () => {
      logger.query('SELECT 1', [], 5, 1);
      expect(consoleSpy.debug).not.toHaveBeenCalled();
      expect(consoleSpy.log).not.toHaveBeenCalled();
    });
  });

  // ─── auth ───────────────────────────────────────────────────────────────

  describe('auth', () => {
    it('prefixes message with [AUTH]', () => {
      // We test the internal call — even if the log level is ERROR-only,
      // the [AUTH] prefix should be in the formatted entry when it IS logged.
      const spy = jest.spyOn(logger, 'info').mockImplementation(() => {});
      logger.auth('Login success', { userId: 1 });
      expect(spy).toHaveBeenCalledWith('[AUTH] Login success', { userId: 1 });
      spy.mockRestore();
    });
  });

  // ─── request ────────────────────────────────────────────────────────────

  describe('request', () => {
    it('delegates to info with a formatted message', () => {
      const spy = jest.spyOn(logger, 'info').mockImplementation(() => {});
      logger.request('GET', '/api/health', 200, 12);
      expect(spy).toHaveBeenCalledWith(
        'GET /api/health - 200',
        expect.objectContaining({ method: 'GET', url: '/api/health', statusCode: 200 })
      );
      spy.mockRestore();
    });

    it('includes extra meta passed to request()', () => {
      const spy = jest.spyOn(logger, 'info').mockImplementation(() => {});
      logger.request('POST', '/api/auth/login', 401, 5, { ip: '127.0.0.1' });
      expect(spy).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({ ip: '127.0.0.1' })
      );
      spy.mockRestore();
    });
  });

  // ─── parseLogLevel ──────────────────────────────────────────────────────

  describe('parseLogLevel', () => {
    it('handles "ERROR" → 0', () => {
      expect(logger.parseLogLevel('ERROR')).toBe(0);
    });

    it('handles "DEBUG" → 3', () => {
      expect(logger.parseLogLevel('DEBUG')).toBe(3);
    });

    it('falls back to INFO (2) for unknown level strings', () => {
      expect(logger.parseLogLevel('UNKNOWN')).toBe(2);
    });

    it('handles lowercase input', () => {
      expect(logger.parseLogLevel('warn')).toBe(1);
    });
  });

  // ─── a logger with INFO level enabled (isolated instance) ───────────────

  describe('INFO-level logger instance', () => {
    let infoLogger;

    beforeEach(() => {
      jest.resetModules();
      process.env.LOG_LEVEL = 'INFO';
      infoLogger = new (require('../../src/utils/logger').constructor)();
    });

    afterEach(() => {
      process.env.LOG_LEVEL = 'ERROR';
    });

    it('shouldLog returns true for INFO at INFO level', () => {
      expect(infoLogger.shouldLog('INFO')).toBe(true);
    });

    it('shouldLog returns true for WARN at INFO level', () => {
      expect(infoLogger.shouldLog('WARN')).toBe(true);
    });

    it('shouldLog returns false for DEBUG at INFO level', () => {
      expect(infoLogger.shouldLog('DEBUG')).toBe(false);
    });

    it('calls console.log for info()', () => {
      infoLogger.info('hello');
      expect(consoleSpy.log).toHaveBeenCalled();
    });

    it('calls console.warn for warn()', () => {
      infoLogger.warn('careful');
      expect(consoleSpy.warn).toHaveBeenCalled();
    });
  });
});
