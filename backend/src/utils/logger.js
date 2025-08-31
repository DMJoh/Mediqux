const fs = require('fs');
const path = require('path');

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
    
    // Create logs directory if it doesn't exist
    this.ensureLogDirectory();
  }

  parseLogLevel(level) {
    const upperLevel = level.toString().toUpperCase();
    return LOG_LEVELS[upperLevel] !== undefined ? LOG_LEVELS[upperLevel] : LOG_LEVELS.INFO;
  }

  ensureLogDirectory() {
    const logsDir = path.join(__dirname, '../../logs');
    if (!fs.existsSync(logsDir)) {
      try {
        fs.mkdirSync(logsDir, { recursive: true });
      } catch (error) {
        // If we can't create logs directory, continue with console only
        console.warn('Could not create logs directory:', error.message);
      }
    }
  }

  formatMessage(level, message, meta = {}) {
    const timestamp = new Date().toISOString();
    const logEntry = {
      timestamp,
      level: level.toUpperCase(),
      message,
      ...meta
    };

    // For console output, make it human readable
    const consoleMessage = `${timestamp} [${level.toUpperCase()}] ${message}`;
    
    return {
      consoleMessage,
      logEntry: JSON.stringify(logEntry)
    };
  }

  shouldLog(level) {
    return LOG_LEVELS[level.toUpperCase()] <= this.currentLevel;
  }

  writeToFile(logEntry, level) {
    try {
      const logFile = path.join(__dirname, '../../logs', `app-${new Date().toISOString().split('T')[0]}.log`);
      const errorLogFile = path.join(__dirname, '../../logs', `error-${new Date().toISOString().split('T')[0]}.log`);
      
      // Write to main log file
      fs.appendFileSync(logFile, logEntry + '\n');
      
      // Write errors to separate error log file
      if (level.toUpperCase() === 'ERROR') {
        fs.appendFileSync(errorLogFile, logEntry + '\n');
      }
    } catch (error) {
      // If file writing fails, continue with console only
      console.warn('Could not write to log file:', error.message);
    }
  }

  log(level, message, meta = {}) {
    if (!this.shouldLog(level)) {
      return;
    }

    const { consoleMessage, logEntry } = this.formatMessage(level, message, meta);

    // Console output with appropriate method
    switch (level.toUpperCase()) {
      case 'ERROR':
        console.error(consoleMessage);
        break;
      case 'WARN':
        console.warn(consoleMessage);
        break;
      case 'DEBUG':
        if (this.debugMode) {
          console.debug(consoleMessage);
        }
        break;
      default:
        console.log(consoleMessage);
    }

    // Write to file (async to not block)
    setImmediate(() => {
      this.writeToFile(logEntry, level);
    });
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