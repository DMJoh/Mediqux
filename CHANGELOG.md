# Changelog

All notable changes to Mediqux will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.0.8] - 2025-10-02

### 🐛 Bug Fixes

#### CORS and Browser Compatibility Issues
- **Fixed ERR_BLOCKED_BY_CLIENT errors** - Resolved browser blocking issues caused by strict single-origin CORS policy
- **Multi-origin CORS support** - Backend now accepts requests from localhost, 127.0.0.1, and configured IP addresses
- **Enhanced port normalization** - Both incoming and allowed origins are normalized for ports 80 and 443, preventing mismatches
- **Fixed logger formatting** - CORS blocked origins now log correctly instead of displaying character array
- **Ad blocker compatibility** - Renamed `/auth/check-setup` endpoint to `/auth/initial-config` to avoid ad blocker interference

### 🔧 Technical Improvements

#### Backend (server.js)
- **Dynamic CORS validation** - Replaced static origin string with function-based validation for multiple origins
- **Bidirectional port normalization** - Normalizes both browser Origin header and server-configured origins for consistent matching
- **Improved logging** - Fixed logger to properly display blocked CORS origins as objects `{ origin }`
- **Support for no-origin requests** - Allows requests without Origin header (mobile apps, curl, Postman)

#### Frontend (auth.js)
- **Updated authentication endpoint** - Changed initial setup check from `/auth/check-setup` to `/auth/initial-config`

#### Configuration
- **Default allowed origins** - Pre-configured: localhost, localhost:8080, localhost:8081, 127.0.0.1, 127.0.0.1:8080, 127.0.0.1:8081
- **Automatic HTTP/HTTPS support** - Both HTTP and HTTPS versions automatically added for FRONTEND_HOST:FRONTEND_PORT
- **Reverse proxy support** - New optional `CORS_ORIGIN` environment variable for custom domains (e.g., `https://fe.mediqux.com`)
- **Comma-separated origins** - `CORS_ORIGIN` supports multiple origins separated by commas
- **Port normalization support** - Origins with `:80` or `:443` are normalized for matching (e.g., `http://localhost:80` → `http://localhost`)

### ✅ Testing
- **Verified multi-origin access** - Tested localhost:8081, 127.0.0.1:8081, 192.168.10.152:8081
- **Verified port normalization** - Tested http://localhost:80 normalizes to http://localhost
- **Verified security** - Tested unauthorized origins (e.g., http://evil.com) are properly blocked and logged

### 🔒 Security
- **Maintained security** - Multi-origin support only allows explicitly configured origins
- **CORS error visibility** - Rejected origins are logged for security monitoring with proper formatting

---

## [1.0.7] - 2025-10-01

### ⚠️ BREAKING CHANGES

**Configuration file changes require migration.** Existing `.env` files will not work with the new `docker-compose.yml`.

#### Variables Removed
- `MEDIQUX_API_URL`, `FRONTEND_URL` - Now auto-constructed from host + port
- `DB_NAME`, `DB_USER`, `DB_PASSWORD`, `DB_PORT` - Use `POSTGRES_*` equivalents instead

#### Variables Added
- `BACKEND_HOST`, `BACKEND_PORT` - For backend API configuration
- `FRONTEND_HOST`, `FRONTEND_PORT` - For frontend configuration
- `POSTGRES_PORT` - Replaces `DB_PORT`

#### Migration Steps

1. **Backup your `.env`**: `cp .env .env.backup`

2. **Copy new template**: `cp .env.example .env`

3. **Migrate values**:
   ```bash
   # OLD variables → NEW variables
   MEDIQUX_API_URL=http://localhost:3000/api → BACKEND_HOST=localhost, BACKEND_PORT=3000
   FRONTEND_URL=http://localhost:8080 → FRONTEND_HOST=localhost, FRONTEND_PORT=8080
   DB_NAME=mediqux_db → POSTGRES_DB=mediqux_db
   DB_USER=mediqux_user → POSTGRES_USER=mediqux_user
   DB_PASSWORD=password → POSTGRES_PASSWORD=password
   DB_PORT=5432 → POSTGRES_PORT=5432
   ```

4. **Update `docker-compose.yml`** to latest version

5. **Restart**: `docker-compose down && docker-compose up -d`

#### Why This Change?

Prevents configuration errors from port/URL mismatches. URLs are now auto-constructed in `docker-compose.yml`:
- `MEDIQUX_API_URL` → `http://${BACKEND_HOST}:${BACKEND_PORT}/api`
- `FRONTEND_URL` → `http://${FRONTEND_HOST}:${FRONTEND_PORT}`

### 🔧 Technical Changes
- Environment variables simplified to host + port pattern
- Removed duplicate database configuration variables
- Added automatic URL construction in `docker-compose.yml`

---

## [1.0.6] - 2025-10-01

### 🔧 Configuration Improvements

#### Environment Variable Simplification
- **Simplified URL configuration** - URLs are now automatically constructed from host and port variables
- **Removed duplicate database variables** - Eliminated redundant `DB_NAME`, `DB_USER`, `DB_PASSWORD` in favor of `POSTGRES_*` variables
- **Separated host and port configuration** - Users can now independently configure `BACKEND_HOST`, `BACKEND_PORT`, `FRONTEND_HOST`, `FRONTEND_PORT`
- **Automatic URL construction** - `MEDIQUX_API_URL` and `FRONTEND_URL` are now built dynamically in docker-compose.yml
- **Reduced configuration errors** - Single source of truth for ports and hosts prevents URL/port mismatch issues

### 🔧 Technical Changes
- Renamed `DB_PORT` to `POSTGRES_PORT` for consistency
- Updated docker-compose.yml to use environment variable substitution for URL construction
- Enhanced .env.example with clearer comments about automatic URL construction

---

## [1.0.5] - 2025-09-13

### 🐛 Bug Fixes

#### Patient Date of Birth Timezone Fix
- **Fixed date of birth display issue** - Patient date of birth now displays the correct date in all timezones instead of showing previous day
- **Resolved UTC midnight conversion problem** - Date-only fields now use UTC date components to prevent timezone-induced date shifts
- **Universal date support** - Patient birth dates display correctly for users in negative timezones (GMT-5, GMT-8, etc.)
- **Consistent date representation** - Birth dates show the same in patient list, edit forms, and detail views

### 🔧 Technical Improvements
- Enhanced date handling in `patients.js` using `getUTCDate()`, `getUTCMonth()`, `getUTCFullYear()` for date-only fields
- Improved date display logic to prevent timezone conversion of midnight UTC timestamps
- Better handling of date vs datetime field differences in frontend

---

## [1.0.4] - 2025-09-13

### 🐛 Bug Fixes

#### Timezone Handling
- **Fixed appointment timezone conversion issue** - Appointments now save and display in correct local time instead of showing UTC offset errors
- **Resolved datetime-local input handling** - Frontend properly converts local time to UTC for storage and back to local time for display
- **Universal timezone support** - System now works correctly for any user timezone (GMT+5:30, GMT-5, etc.)
- **Fixed edit form datetime population** - Edit forms now show the original time entered instead of displaying UTC time with offset

### 🔧 Technical Improvements
- Enhanced datetime handling in `appointments.js` for proper timezone conversion
- Improved datetime-local input value processing for consistent behavior across timezones
- Better separation of concerns between frontend time display and backend UTC storage

---

## [1.0.0] - 2025-09-07

### 🎉 Initial Release

**Mediqux v1.0.0** - A comprehensive medical management system for healthcare operations.

### ✨ Core Features

#### 🏥 Healthcare Entity Management
- **Patient Management** - Complete CRUD operations for patient demographics and medical information
- **Doctor Management** - Healthcare provider profiles with specializations and contact details
- **Institution Management** - Hospitals, clinics, and lab facility registration
- **Appointment Scheduling** - Patient visit management with doctor-institution coordination
- **Medical Conditions** - Disease/condition catalog with ICD code support
- **Medication Catalog** - Drug database with active ingredients stored as JSONB
- **Prescription Management** - Medication prescribing workflow linked to appointments

#### 🔬 Advanced Lab Reports System
- **PDF Upload & Processing** - Automatic text extraction from lab report PDFs using pdf-parse
- **Smart Value Detection** - AI-powered extraction of lab values with pattern recognition for:
  - Complete Blood Count (CBC)
  - Comprehensive Metabolic Panel (CMP) 
  - Lipid Panel
  - Thyroid Function Tests
  - Liver Function Tests
- **Suggestion Review Workflow** - Full-screen modal for reviewing, editing, and accepting extracted values
- **Confidence Scoring** - Reliability indicators for automatically extracted lab values
- **Manual Lab Entry** - Comprehensive forms with common test templates
- **PDF File Management** - Secure storage with descriptive filenames (`test_name_date_patient_name.pdf`)
- **Lab Value CRUD** - Complete management of individual lab values with edit capabilities

#### 🔐 Authentication & Security
- **JWT-Based Authentication** - Secure token-based login system with localStorage management
- **Role-Based Access Control (RBAC)** - Admin and user roles with different permission levels
- **Patient Data Filtering** - Users only access data for their associated patients
- **Automatic Token Refresh** - Seamless session management with token expiration handling
- **Protected API Endpoints** - All routes secured with authentication middleware

#### 🛠 Technical Architecture
- **Node.js 24 LTS Backend** - Modern Express.js API server
- **PostgreSQL 17 Database** - Robust relational database with JSONB support
- **Sequelize 6.x ORM** - Type-safe database operations with automatic migrations
- **Vanilla Frontend** - HTML/CSS/JavaScript with Bootstrap 5 UI framework
- **Docker Compose Deployment** - Containerized application with development and production configurations

### 🔧 Technical Specifications

#### Backend Stack
- Node.js 24 LTS with Express.js
- PostgreSQL 17 with Sequelize ORM
- JWT authentication with bcrypt password hashing
- PDF processing with pdf-parse library
- CORS configuration for cross-origin requests
- Comprehensive error handling and logging

#### Frontend Stack  
- Vanilla JavaScript with Bootstrap 5
- Environment-configurable backend URL (`MEDIQUX_API_URL`)
- Responsive mobile-friendly design
- Real-time health monitoring dashboard
- File upload with progress tracking

#### Database Features
- UUID primary keys for all entities
- JSONB support for flexible data structures
- Comprehensive indexing for optimized queries
- Automatic timestamps with database triggers
- Migration system with up/down support
- Model associations and foreign key constraints

### 🚀 Deployment Options

- **Production**: Docker Compose with GHCR images (`docker-compose up -d`)
- **Development**: Local builds with live reload (`docker-compose -f docker-compose.dev.yml up -d`)
- **Manual**: Backend development server with nodemon (`npm run dev`)

### 📊 API Endpoints

Complete RESTful API with 50+ endpoints across:
- Authentication (`/api/auth/*`)
- Patient management (`/api/patients/*`)
- Doctor management (`/api/doctors/*`)
- Institution management (`/api/institutions/*`)
- Appointment scheduling (`/api/appointments/*`)
- Lab reports with PDF processing (`/api/test-results/*`)
- Medication catalog (`/api/medications/*`)
- Medical conditions (`/api/conditions/*`)
- Prescription management (`/api/prescriptions/*`)
- System health monitoring (`/api/health`, `/api/system/*`)

### 🎯 Key Highlights

- **Local PDF Processing** - Secure, offline PDF text extraction (no external APIs)
- **Smart Lab Value Extraction** - Advanced pattern recognition for common lab panels
- **Comprehensive RBAC** - Fine-grained access control with patient data filtering
- **Zero-Config Deployment** - Automatic database migrations on startup
- **Health Monitoring** - Built-in system health checks and component tests
- **Responsive Design** - Mobile-friendly Bootstrap UI
- **Environmental Configuration** - Runtime backend URL configuration for Docker deployments

### 📋 System Requirements

- Node.js 24 LTS or higher
- PostgreSQL 17
- Docker & Docker Compose (for containerized deployment)
- Modern web browser with JavaScript support

### 🔒 Security Features

- JWT token-based authentication
- Bcrypt password hashing
- SQL injection prevention with parameterized queries
- CORS protection with proper header configuration
- Role-based data access filtering
- Secure file upload and storage

---

## License

Creative Commons Attribution-NonCommercial-ShareAlike 4.0 International (CC BY-NC-SA 4.0)

This project allows forking, using, modifying, and distributing while preventing commercial use. Attribution and same license required for derivatives.