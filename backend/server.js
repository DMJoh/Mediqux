const express = require('express');
const cors = require('cors');
const path = require('path');
require('dotenv').config({ quiet: true });

const rateLimit = require('express-rate-limit');
const logger = require('./src/utils/logger');
const { sequelize } = require('./src/models');

const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 300,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, error: 'Too many requests, please try again later.' }
});

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, error: 'Too many authentication attempts, please try again later.' }
});

const app = express();
const PORT = process.env.PORT || 3000;

// CORS Configuration - Allow all origins
// Security is handled by JWT authentication layer
app.use(cors({
  origin: true, // Allow all origins
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
const diagnosticStudiesRoutes = require('./src/routes/diagnostic-studies');

// Public routes (no authentication required)
app.use('/api/auth', authLimiter, authRoutes);

// Protected routes (authentication required)
app.use('/api/users', apiLimiter, authenticateToken, usersRoutes);
app.use('/api/patients', apiLimiter, authenticateToken, patientRoutes);
app.use('/api/doctors', apiLimiter, authenticateToken, doctorRoutes);
app.use('/api/institutions', apiLimiter, authenticateToken, institutionRoutes);
app.use('/api/appointments', apiLimiter, authenticateToken, appointmentRoutes);
app.use('/api/conditions', apiLimiter, authenticateToken, conditionRoutes);
app.use('/api/medications', apiLimiter, authenticateToken, medicationRoutes);
app.use('/api/prescriptions', apiLimiter, authenticateToken, prescriptionRoutes);
app.use('/api/test-results', apiLimiter, authenticateToken, testResultRoutes);
app.use('/api/diagnostic-studies', apiLimiter, authenticateToken, diagnosticStudiesRoutes);

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
app.use('/*splat', (req, res) => {
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