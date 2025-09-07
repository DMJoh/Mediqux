// Structured logging for STDOUT/Docker logs

// Logger levels in order of severity
const LOG_LEVELS = {
  ERROR: 0,
  WARN: 1,
  INFO: 2,
  DEBUG: 3
};

class Logger {
  constructor() {
    // Get log level from environment (default to INFO)
    this.currentLevel = this.parseLogLevel(process.env.LOG_LEVEL || 'INFO');
    
    // Check if DEBUG mode is enabled
    this.debugMode = process.env.DEBUG === 'true' || process.env.NODE_ENV === 'development';
    
    // Enable query logging based on DEBUG or LOG_LEVEL=DEBUG
    this.queryLogging = this.debugMode || this.currentLevel >= LOG_LEVELS.DEBUG;
  }

  parseLogLevel(level) {
    const upperLevel = level.toString().toUpperCase();
    return LOG_LEVELS[upperLevel] !== undefined ? LOG_LEVELS[upperLevel] : LOG_LEVELS.INFO;
  }

  formatMessage(level, message, meta = {}) {
    const timestamp = new Date().toISOString();
    const logEntry = {
      timestamp,
      level: level.toUpperCase(),
      message,
      ...meta
    };

    // For console output, use structured JSON for better parsing
    return JSON.stringify(logEntry);
  }

  shouldLog(level) {
    return LOG_LEVELS[level.toUpperCase()] <= this.currentLevel;
  }

  log(level, message, meta = {}) {
    if (!this.shouldLog(level)) {
      return;
    }

    const logEntry = this.formatMessage(level, message, meta);

    // Output structured JSON to console
    switch (level.toUpperCase()) {
      case 'ERROR':
        console.error(logEntry);
        break;
      case 'WARN':
        console.warn(logEntry);
        break;
      case 'DEBUG':
        if (this.debugMode) {
          console.debug(logEntry);
        }
        break;
      default:
        console.log(logEntry);
    }
  }

  error(message, meta = {}) {
    this.log('ERROR', message, meta);
  }

  warn(message, meta = {}) {
    this.log('WARN', message, meta);
  }

  info(message, meta = {}) {
    this.log('INFO', message, meta);
  }

  debug(message, meta = {}) {
    this.log('DEBUG', message, meta);
  }

  // Special method for database queries
  query(queryText, params, duration, rowCount) {
    if (!this.queryLogging) {
      return;
    }

    const meta = {
      query: queryText,
      params: params || [],
      duration: `${duration}ms`,
      rows: rowCount
    };

    this.debug('Database query executed', meta);
  }

  // Special method for authentication events
  auth(message, meta = {}) {
    this.info(`[AUTH] ${message}`, meta);
  }

  // Special method for API requests (if needed)
  request(method, url, statusCode, duration, meta = {}) {
    const requestMeta = {
      method,
      url,
      statusCode,
      duration: `${duration}ms`,
      ...meta
    };

    this.info(`${method} ${url} - ${statusCode}`, requestMeta);
  }
}

// Create singleton instance
const logger = new Logger();

module.exports = logger;