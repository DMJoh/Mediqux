# Medical Management System

A comprehensive full-stack web application for managing healthcare operations including patients, doctors, appointments, medications, and medical conditions. Built with Node.js, PostgreSQL, and vanilla JavaScript.

## Features

- **Patient Management**: Complete patient records with demographic information
- **Doctor Management**: Healthcare provider profiles and specialization tracking
- **Institution Management**: Hospital, clinic, and laboratory information
- **Appointment Scheduling**: Patient visit scheduling and management
- **Medication Catalog**: Comprehensive drug database with active ingredients (JSONB)
- **Medical Conditions**: Disease/condition catalog with ICD code support
- **Lab Reports Management**: PDF upload with automated text extraction and value parsing
- **Prescription Management**: Medication prescribing during appointments
- **Health Monitoring**: Built-in system health checks and diagnostics

## Architecture

### Backend
- **Node.js/Express** - RESTful API server
- **PostgreSQL** - Primary database with JSONB support
- **UUID Primary Keys** - All entities use UUID for better distribution
- **Local PDF Processing** - Secure offline PDF text extraction using pdf-parse
- **Smart Lab Value Detection** - Pattern recognition for common lab panels

### Frontend
- **Vanilla JavaScript** - No frameworks, lightweight and fast
- **Bootstrap 5** - Responsive UI components
- **Bootstrap Icons** - Consistent iconography
- **Nginx** - Static file serving in production

### Infrastructure
- **Docker Compose** - Containerized deployment
- **PostgreSQL 17 Alpine** - Lightweight database container
- **Nginx** - Frontend web server

## Quick Start

### Prerequisites
- Docker and Docker Compose
- Node.js 18+ (for local development)

### Installation

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd med-app
   ```

2. **Start all services**
   ```bash
   docker-compose up -d
   ```

3. **Access the application**
   - Frontend: http://localhost:8080
   - Backend API: http://localhost:3000
   - Database: localhost:5432

### Development Setup

1. **Backend development server**
   ```bash
   cd backend
   npm install
   npm run dev  # Auto-restart on changes
   ```

2. **Health checks**
   ```bash
   curl http://localhost:3000/api/health
   curl http://localhost:3000/api/test-db
   ```

## Project Structure

```
med-app/
├── backend/                    # Node.js API server
│   ├── src/
│   │   ├── database/          # Database connection and helpers
│   │   ├── routes/            # API endpoints
│   │   ├── middleware/        # Express middleware
│   │   └── utils/             # Utility functions
│   ├── logs/                  # Application logs
│   ├── uploads/               # File uploads (lab reports)
│   ├── server.js              # Main application entry
│   └── package.json
├── frontend/                   # Static web files
│   ├── css/                   # Stylesheets
│   ├── js/                    # JavaScript modules
│   ├── *.html                 # HTML pages
│   └── nginx.conf
├── database/                   # Database initialization
│   └── init.sql
├── docker-compose.yml         # Container orchestration
└── CLAUDE.md                  # Development guidelines
```

## API Endpoints

### Core Entities
- `GET|POST /api/patients` - Patient management
- `GET|POST /api/doctors` - Doctor management
- `GET|POST /api/institutions` - Institution management
- `GET|POST /api/appointments` - Appointment scheduling
- `GET|POST /api/medications` - Medication catalog
- `GET|POST /api/conditions` - Medical conditions
- `GET|POST /api/prescriptions` - Prescription management
- `GET|POST /api/lab-reports` - Lab report management

### System Health
- `GET /api/health` - System health status
- `GET /api/test-db` - Database connectivity test
- `GET /api/test-appointments` - Appointment module test
- `GET /api/test-conditions` - Conditions module test
- `GET /api/test-medications` - Medications module test

## Database Schema

### Key Tables
- **patients** - Patient demographic and contact information
- **doctors** - Healthcare provider details and specializations
- **institutions** - Medical facilities (hospitals, clinics, labs)
- **appointments** - Patient visits and consultation records
- **medications** - Drug catalog with JSONB active ingredients
- **medical_conditions** - Disease catalog with ICD codes
- **prescriptions** - Medications prescribed during appointments
- **test_results** - Lab reports with PDF file storage
- **lab_values** - Extracted values from lab reports

### Features
- UUID primary keys for all entities
- JSONB support for flexible medication data
- Comprehensive indexing for optimized queries
- Foreign key relationships with referential integrity

## Configuration

### Environment Variables
```bash
# Database Configuration
DB_HOST=localhost
DB_PORT=5432
DB_NAME=medical_app
DB_USER=medboy
DB_PASSWORD=SpaceMed@123

# Application Configuration
NODE_ENV=development
FRONTEND_URL=http://localhost:8080
```

### Docker Services
- **postgres**: PostgreSQL 17 Alpine (port 5432)
- **backend**: Node.js API server (port 3000)
- **frontend**: Nginx static server (port 8080)

## Lab Reports & PDF Processing

The system includes advanced lab report management with:

- **PDF Upload**: Secure file upload with validation
- **Local Text Extraction**: Uses pdf-parse for offline processing
- **Smart Value Detection**: Automatic recognition of common lab panels:
  - Complete Blood Count (CBC)
  - Comprehensive Metabolic Panel (CMP)
  - Lipid Panel
  - Thyroid Function Tests
  - Liver Function Tests
- **Manual Entry**: Comprehensive forms with common test templates
- **Value Storage**: Structured lab values in PostgreSQL

## Security Features

- Parameterized database queries to prevent SQL injection
- CORS configuration for secure frontend-backend communication
- Local PDF processing (no external services)
- Input validation and sanitization
- Error handling with detailed logging

## Monitoring & Diagnostics

- Built-in health check endpoints
- Component-specific testing endpoints
- Centralized error handling and logging
- Database connection monitoring

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test thoroughly using health check endpoints
5. Submit a pull request

## License

[Add your license information here]

## Support

For issues or questions:
1. Check the health endpoints for system status
2. Review logs in `backend/logs/`
3. Verify database connectivity with test endpoints
4. [Add your support contact information]