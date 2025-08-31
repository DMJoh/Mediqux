const express = require('express');
const cors = require('cors');
const path = require('path');
require('dotenv').config();

const logger = require('./src/utils/logger');

const app = express();
const PORT = process.env.PORT || 3000;

// Enhanced middleware
app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:8080',
  credentials: true
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

// Test medications functionality
app.get('/api/test-medications', async (req, res) => {
  try {
    const db = require('./src/database/db');
    
    // Test basic query
    const medicationResult = await db.query('SELECT COUNT(*) as count FROM medications');
    
    res.json({
      success: true,
      message: 'Medications system test successful',
      data: {
        medications: medicationResult.rows[0].count
      }
    });
  } catch (error) {
    logger.error('Medications test failed', { error: error.message, stack: error.stack });
    res.status(500).json({
      success: false,
      error: 'Medications system test failed',
      details: error.message
    });
  }
});

// Test conditions functionality
app.get('/api/test-conditions', async (req, res) => {
  try {
    const db = require('./src/database/db');
    
    // Test basic query
    const conditionResult = await db.query('SELECT COUNT(*) as count FROM medical_conditions');
    
    res.json({
      success: true,
      message: 'Conditions system test successful',
      data: {
        conditions: conditionResult.rows[0].count
      }
    });
  } catch (error) {
    logger.error('Conditions test failed', { error: error.message, stack: error.stack });
    res.status(500).json({
      success: false,
      error: 'Conditions system test failed',
      details: error.message
    });
  }
});

// Test appointment functionality
app.get('/api/test-appointments', async (req, res) => {
  try {
    const db = require('./src/database/db');
    
    // Test basic query
    const appointmentResult = await db.query('SELECT COUNT(*) as count FROM appointments');
    const patientResult = await db.query('SELECT COUNT(*) as count FROM patients');
    const doctorResult = await db.query('SELECT COUNT(*) as count FROM doctors');
    
    res.json({
      success: true,
      message: 'Appointment system test successful',
      data: {
        appointments: appointmentResult.rows[0].count,
        patients: patientResult.rows[0].count,
        doctors: doctorResult.rows[0].count
      }
    });
  } catch (error) {
    logger.error('Appointment test failed', { error: error.message, stack: error.stack });
    res.status(500).json({
      success: false,
      error: 'Appointment system test failed',
      details: error.message
    });
  }
});

// Test database connection
app.get('/api/test-db', async (req, res) => {
  try {
    const db = require('./src/database/db');
    const result = await db.query('SELECT NOW() as current_time, version() as postgres_version');
    res.json({
      success: true,
      message: 'Database connection successful',
      data: result.rows[0]
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

// Start server
app.listen(PORT, '0.0.0.0', () => {
  logger.info(`Backend server running on port ${PORT}`, { 
    port: PORT, 
    environment: process.env.NODE_ENV || 'development',
    logLevel: process.env.LOG_LEVEL || 'INFO',
    debugMode: process.env.DEBUG === 'true'
  });
  logger.info(`Health check: http://localhost:${PORT}/api/health`);
});