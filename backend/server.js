const express = require('express');
const cors = require('cors');
const path = require('path');
require('dotenv').config();

const logger = require('./src/utils/logger');
const { sequelize } = require('./src/models');

const app = express();
const PORT = process.env.PORT || 3000;

// Enhanced middleware - Support multiple origins with proper normalization
const allowedOrigins = [
  process.env.FRONTEND_URL || 'http://localhost:8080',
  'http://localhost:8080',
  'http://localhost:8081',
  'http://127.0.0.1:8080',
  'http://127.0.0.1:8081',
];

// Add environment-specific origin
if (process.env.FRONTEND_HOST && process.env.FRONTEND_PORT) {
  const envOrigin = `http://${process.env.FRONTEND_HOST}:${process.env.FRONTEND_PORT}`;
  if (!allowedOrigins.includes(envOrigin)) {
    allowedOrigins.push(envOrigin);
  }
}

// Normalize function - removes default ports
function normalizeOrigin(url) {
  if (!url) return url;
  return url.replace(/:80$/, '').replace(/:443$/, '');
}

app.use(cors({
  origin: function (origin, callback) {
    // Allow requests with no origin (mobile apps, curl, Postman)
    if (!origin) return callback(null, true);

    // Normalize BOTH the incoming origin AND all allowed origins
    const normalizedIncoming = normalizeOrigin(origin);
    const normalizedAllowed = allowedOrigins.map(o => normalizeOrigin(o));

    if (normalizedAllowed.includes(normalizedIncoming)) {
      callback(null, true);
    } else {
      logger.warn('CORS blocked request from origin:', origin);
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
  exposedHeaders: ['Content-Disposition', 'Content-Type', 'Content-Length']
}));

app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Create uploads directory if it doesn't exist
const fs = require('fs');
const uploadsDir = './uploads';
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

// Serve uploaded files
app.use('/uploads', express.static('uploads'));


// System database connectivity check (enhanced with Sequelize)
app.get('/api/system/database', async (req, res) => {
  try {
    // Test Sequelize connection
    await sequelize.authenticate();
    const [results] = await sequelize.query('SELECT NOW() as current_time, version() as postgres_version');
    
    res.json({
      success: true,
      message: 'Database connection successful (Sequelize)',
      orm: 'Sequelize',
      data: results[0]
    });
  } catch (error) {
    logger.error('Database test failed', { error: error.message, stack: error.stack });
    res.status(500).json({
      success: false,
      error: 'Database connection failed',
      details: error.message
    });
  }
});

// Routes
const authRoutes = require('./src/routes/auth');
const usersRoutes = require('./src/routes/users');
const { authenticateToken } = require('./src/middleware/auth');
const patientRoutes = require('./src/routes/patients');
const doctorRoutes = require('./src/routes/doctors');
const institutionRoutes = require('./src/routes/institutions');
const appointmentRoutes = require('./src/routes/appointments');
const conditionRoutes = require('./src/routes/conditions');
const medicationRoutes = require('./src/routes/medications');
const prescriptionRoutes = require('./src/routes/prescriptions');
const testResultRoutes = require('./src/routes/test-results');

// Public routes (no authentication required)
app.use('/api/auth', authRoutes);

// Protected routes (authentication required)
app.use('/api/users', authenticateToken, usersRoutes);
app.use('/api/patients', authenticateToken, patientRoutes);
app.use('/api/doctors', authenticateToken, doctorRoutes);
app.use('/api/institutions', authenticateToken, institutionRoutes);
app.use('/api/appointments', authenticateToken, appointmentRoutes);
app.use('/api/conditions', authenticateToken, conditionRoutes);
app.use('/api/medications', authenticateToken, medicationRoutes);
app.use('/api/prescriptions', authenticateToken, prescriptionRoutes);
app.use('/api/test-results', authenticateToken, testResultRoutes);

// Enhanced health check with system info
app.get('/api/health', (req, res) => {
  res.json({ 
    status: 'Server running',
    timestamp: new Date(),
    nodeVersion: process.version,
    uptime: process.uptime(),
    environment: process.env.NODE_ENV || 'development'
  });
});

// Routes will be added here as we build features

// Error handling middleware
app.use((err, req, res, next) => {
  logger.error('Unhandled application error', { error: err.message, stack: err.stack });
  res.status(500).json({ 
    error: 'Something went wrong!',
    message: process.env.NODE_ENV === 'development' ? err.message : 'Internal server error'
  });
});

// 404 handler
app.use('*', (req, res) => {
  logger.warn('Route not found', { method: req.method, path: req.path });
  res.status(404).json({ error: 'Route not found' });
});

// Graceful shutdown
process.on('SIGTERM', () => {
  logger.info('SIGTERM received, shutting down gracefully');
  process.exit(0);
});

// Database initialization and server startup
async function initializeServer() {
  try {
    // Test Sequelize connection
    logger.info('Testing database connection...');
    await sequelize.authenticate();
    logger.info('Database connection established successfully');
    
    // Note: We're not auto-running migrations. Users should run them manually.
    logger.info('Database ready. Run migrations with: npm run db:migrate');
    
    // Start server
    app.listen(PORT, '0.0.0.0', () => {
      logger.info(`Backend server running on port ${PORT}`, { 
        port: PORT, 
        environment: process.env.NODE_ENV || 'development',
        logLevel: process.env.LOG_LEVEL || 'INFO',
        debugMode: process.env.DEBUG === 'true',
        orm: 'Sequelize'
      });
      logger.info(`Health check: http://localhost:${PORT}/api/health`);
      logger.info(`Database test: http://localhost:${PORT}/api/system/database`);
    });
    
  } catch (error) {
    logger.error('Failed to initialize server:', error);
    process.exit(1);
  }
}

// Initialize server
initializeServer();