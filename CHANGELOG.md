# Changelog

All notable changes to Mediqux will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

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