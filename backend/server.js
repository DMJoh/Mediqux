const express = require('express');
const cors = require('cors');
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

// The backend is never exposed directly to the host in either dev or prod
// (Caddy fronts it in prod, Vite's dev proxy fronts it in dev) — trusting
// exactly one hop lets express-rate-limit and req.ip read the real client
// IP from X-Forwarded-For instead of the proxy's own address, without
// trusting a longer chain a client could spoof into. Anyone running their
// own reverse proxy in front of Mediqux's own (Traefik, Nginx Proxy
// Manager, a Cloudflare Tunnel, ...) adds a second hop, and should set
// TRUST_PROXY_HOPS=2 accordingly — see the README for details. Not in
// .env.example on purpose: the default of 1 is correct for the vast
// majority of installs that don't do this, and shouldn't be something
// every new user has to stop and think about.
app.set('trust proxy', Number(process.env.TRUST_PROXY_HOPS) || 1);

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

// Uploaded files (lab report PDFs, diagnostic study attachments) are
// intentionally NOT served statically here — that bypassed the RBAC checks
// on test-results.js's and diagnostic-studies.js's /:id/view and
// /:id/download routes, since a raw /uploads/<filename> path was fetchable
// by anyone with no auth at all. Those authenticated routes read the same
// files straight off disk instead.

// Public routes (no authentication required) — rate-limited by the
// stricter authLimiter instead of the general apiLimiter applied below.
const authRoutes = require('./src/routes/auth');
app.use('/api/auth', authLimiter, authRoutes);

// Every route registered from here on is rate-limited by apiLimiter,
// applied once instead of threading it through each individual mount —
// a request matched and answered by the /api/auth router above never
// reaches this middleware.
app.use(apiLimiter);

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

// Protected routes (authentication required)
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

app.use('/api/users', authenticateToken, usersRoutes);
app.use('/api/patients', authenticateToken, patientRoutes);
app.use('/api/doctors', authenticateToken, doctorRoutes);
app.use('/api/institutions', authenticateToken, institutionRoutes);
app.use('/api/appointments', authenticateToken, appointmentRoutes);
app.use('/api/conditions', authenticateToken, conditionRoutes);
app.use('/api/medications', authenticateToken, medicationRoutes);
app.use('/api/prescriptions', authenticateToken, prescriptionRoutes);
app.use('/api/test-results', authenticateToken, testResultRoutes);
app.use('/api/diagnostic-studies', authenticateToken, diagnosticStudiesRoutes);

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