const { Pool } = require('pg');
const logger = require('../utils/logger');

if (!process.env.DB_USER || !process.env.DB_PASSWORD) {
  throw new Error('DB_USER and DB_PASSWORD environment variables are required');
}

const pool = new Pool({
  host: process.env.DB_HOST || 'localhost',
  port: process.env.DB_PORT || 5432,
  database: process.env.DB_NAME || 'medical_app',
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
});

pool.on('connect', () => {
  logger.info('Connected to PostgreSQL database');
});

pool.on('error', (err) => {
  logger.error('Database connection error', { error: err.message, stack: err.stack });
});

const query = async (text, params) => {
  const start = Date.now();
  try {
    const res = await pool.query(text, params);
    const duration = Date.now() - start;
    
    logger.query(text, params, duration, res.rowCount);
    
    return res;
  } catch (error) {
    const duration = Date.now() - start;
    logger.error('Database query error', { 
      query: text, 
      params, 
      duration: `${duration}ms`,
      error: error.message, 
      code: error.code 
    });
    throw error;
  }
};

const getClient = async () => {
  const client = await pool.connect();
  return client;
};

module.exports = {
  query,
  getClient,
  pool
};