const { Pool } = require('pg');
const logger = require('../utils/logger');

// Database connection configuration
const pool = new Pool({
  host: process.env.DB_HOST || 'localhost',
  port: process.env.DB_PORT || 5432,
  database: process.env.DB_NAME || 'medical_app',
  user: process.env.DB_USER || 'medboy',
  password: process.env.DB_PASSWORD || 'SpaceMed@123',
  max: 20, // Maximum number of connections
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
});

// Test database connection
pool.on('connect', () => {
  logger.info('Connected to PostgreSQL database');
});

pool.on('error', (err) => {
  logger.error('Database connection error', { error: err.message, stack: err.stack });
});

// Helper function to execute queries
const query = async (text, params) => {
  const start = Date.now();
  try {
    const res = await pool.query(text, params);
    const duration = Date.now() - start;
    
    // Log query execution using the logger
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

// Helper function to get a single client for transactions
const getClient = async () => {
  const client = await pool.connect();
  return client;
};

module.exports = {
  query,
  getClient,
  pool
};