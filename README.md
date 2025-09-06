# 🏥 Mediqux - Medical Management System

[![License: CC BY-NC-SA 4.0](https://img.shields.io/badge/License-CC%20BY--NC--SA%204.0-lightgrey.svg)](https://creativecommons.org/licenses/by-nc-sa/4.0/)
[![Docker](https://img.shields.io/badge/Docker-Containerized-blue)](https://docker.com)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-17-blue)](https://postgresql.org)

> **🔒 PRIVACY FIRST: Mediqux is designed to run entirely on your local infrastructure. No data leaves your environment - all processing, storage, and PDF analysis happens locally on your servers.**

A comprehensive, privacy-focused medical management system for healthcare facilities. Built for complete local deployment with no external dependencies or cloud services.

## 🌟 Why Mediqux?

### 🔐 **100% Local & Private**
- **No cloud dependencies** - Everything runs on your infrastructure
- **Local PDF processing** - Lab reports analyzed offline using local libraries
- **Complete data sovereignty** - Your patient data never leaves your premises
- **No internet required** for core functionality (only for initial setup)

### 🏥 **Healthcare-Focused Design**
- Built specifically for medical facilities and healthcare operations
- Supports complex medical workflows and relationships
- Designed with healthcare data sensitivity in mind

---

## 🚀 Features

### 👥 **Patient & Provider Management**
- **Patient Records**: Complete demographic information, contact details, emergency contacts
- **Doctor Management**: Healthcare provider profiles, specializations, license tracking
- **Institution Management**: Hospitals, clinics, laboratories with contact information
- **Doctor-Institution Relationships**: Many-to-many relationships for complex healthcare networks

### 📅 **Appointment & Visit Management**
- **Appointment Scheduling**: Patient visits, consultation booking
- **Visit Types**: Consultation, Follow-up, Emergency, Surgery, Therapy
- **Status Tracking**: Scheduled, Confirmed, In-Progress, Completed, Cancelled
- **Notes & Diagnosis**: Detailed visit documentation

### 💊 **Medication & Prescription System**
- **Comprehensive Drug Database**: Medication catalog with JSONB active ingredients
- **Advanced Medication Data**: Dosage forms, strengths, manufacturer information
- **Prescription Management**: Link medications to appointments and patient visits
- **Patient Medication History**: Current and past medications with status tracking
- **Smart Search**: Search by name, generic name, or active ingredients

### 🏷️ **Medical Conditions & Coding**
- **Disease Catalog**: Comprehensive medical conditions database
- **ICD Code Support**: International Classification of Diseases coding
- **Condition Categories**: Organized by medical specialty and system
- **Severity Levels**: Low, Medium, High, Critical classification
- **Usage Tracking**: See how conditions are used across prescriptions

### 🧪 **Lab Reports Management**
- **PDF Upload & Processing**: Secure local PDF upload with basic text extraction
- **Pattern-Based Value Detection**: Simple pattern recognition for common lab panels:
  - Complete Blood Count (CBC)
  - Comprehensive Metabolic Panel (CMP)
  - Basic Metabolic Panel (BMP)
  - Lipid Panel
  - Liver Function Tests (LFT)
  - Kidney Function Tests (KFT)
  - Thyroid Function Tests
- **Basic Extraction Results**: Simple text parsing provides suggestions that may need review and correction
- **Manual Lab Entry**: Comprehensive forms with test templates for accurate data entry
- **Value Storage**: Structured lab values with reference ranges and status
- **File Management**: Descriptive PDF filenames, secure storage
- **Lab Panels System**: Standardized test groupings with parameter definitions

> **📝 Note**: PDF text extraction uses basic pattern matching and is not perfect. It provides a starting point for data entry but extracted values should always be verified against the original document. The system is designed to assist with data entry, not replace manual review.

### 🔐 **Authentication & Security**
- **JWT-Based Authentication**: Secure token-based login system
- **Role-Based Access Control (RBAC)**: Admin and user roles with different permissions
- **Patient Data Filtering**: Users only see data for their associated patients
- **Session Management**: Automatic logout on token expiration
- **Password Security**: Secure password hashing and validation

### 🎨 **User Experience**
- **Responsive Design**: Mobile-friendly Bootstrap 5 interface
- **Dark/Light Theme**: Toggle between themes with persistent user preference
- **Intuitive Navigation**: Clean, healthcare-focused UI design
- **Advanced Search & Filtering**: Quick access to patient and medical data
- **Real-time Health Monitoring**: System status and component health checks

### 📊 **Reporting & Analytics**
- **Dashboard Overview**: System health, recent activities, quick stats
- **Usage Statistics**: Patient counts, appointment summaries, medication usage
- **Lab Report Analytics**: Test result trends and basic value analysis
- **Export Capabilities**: PDF downloads with descriptive filenames

### 🔧 **System Administration**
- **Health Check Endpoints**: Comprehensive system monitoring
- **Database Management**: Automated initialization and migrations
- **File Upload Management**: Configurable file size limits and storage
- **Logging System**: Detailed application and access logs
- **User Management**: Admin-controlled user registration and role assignment

---

## 🏗️ Architecture

### 🔧 **Backend Stack**
- **Node.js 22** with Express framework
- **PostgreSQL 17** with JSONB support for flexible data
- **UUID Primary Keys** for all entities (better distribution and security)
- **Local PDF Processing** using pdf-parse library (completely offline)
- **Basic Pattern Recognition** for lab value extraction (simple text parsing)
- **Comprehensive API** with RESTful endpoints

### 🎨 **Frontend Stack**
- **Vanilla JavaScript** - No frameworks, lightweight and fast
- **Bootstrap 5** - Modern, responsive UI components
- **Bootstrap Icons** - Consistent iconography throughout
- **Environment-configurable** backend URL for flexible deployment

### 🐳 **Infrastructure**
- **Docker Compose** - Complete containerized deployment
- **Multi-environment support** - Development and production configurations
- **Volume persistence** - Data, uploads, and logs persist across restarts
- **Health checks** - Built-in container health monitoring
- **Nginx** - Efficient static file serving

---

## 📋 Installation

### 🔧 Prerequisites
- **Docker** and **Docker Compose** installed on your system
- **Minimum 2GB RAM** and **10GB disk space**
- **Linux/macOS/Windows** with Docker support

### 🏭 Production Installation (Recommended)

**Step 1: Download and Configure**
```bash
# Create application directory
mkdir mediqux && cd mediqux

# Download docker-compose.yml
curl -O https://raw.githubusercontent.com/your-repo/mediqux/main/docker-compose.yml

# Download environment template
curl -O https://raw.githubusercontent.com/your-repo/mediqux/main/.env.example

# Create your environment configuration
cp .env.example .env
```

**Step 2: Configure Environment**
Edit `.env` file with your settings:
```bash
# Database Configuration (Change these!)
POSTGRES_PASSWORD=your_secure_database_password
JWT_SECRET=your_long_random_jwt_secret_key
SESSION_SECRET=your_session_secret_key

# API Configuration
MEDIQUX_API_URL=http://your-server:3000/api
FRONTEND_URL=http://your-server:8080

# Optional: Adjust file upload limits
MAX_FILE_SIZE=50MB

# Optional: User/Group IDs (usually 1000 works)
PUID=1000
PGID=1000
```

**Step 3: Deploy**
```bash
# Start all services
docker-compose up -d

# Check deployment status
docker-compose ps
docker-compose logs
```

**Step 4: Access Your Installation**
- **Web Interface**: http://your-server:8080
- **API Endpoint**: http://your-server:3000/api
- **Health Check**: http://your-server:3000/api/health

**Step 5: Create Admin Account**
1. Open the web interface
2. You'll see a setup screen for first-time installation
3. Create your admin account
4. Start managing your medical data!

### 🔧 Development Installation

For developers or advanced users who want to modify the system:

```bash
# Clone repository
git clone <repository-url>
cd mediqux

# Copy environment template
cp .env.example .env

# Start development environment
docker-compose -f docker-compose.dev.yml up -d

# The system will build from source code
```

### 📁 Directory Structure After Installation
```
mediqux/
├── docker-compose.yml          # Production deployment
├── .env                        # Your configuration
├── docker volumes:
│   ├── postgres_data/          # Database files
│   ├── mediqux_uploads/        # Uploaded lab reports
│   └── mediqux_logs/           # Application logs
```

---

## 🔧 Configuration

### 🌐 Network Configuration
```bash
# Frontend URL (where users access the web interface)
FRONTEND_URL=http://your-server:8080

# API URL (where frontend connects to backend)
MEDIQUX_API_URL=http://your-server:3000/api
```

### 🔒 Security Configuration
```bash
# Strong JWT secret (generate a long random string)
JWT_SECRET=your_very_long_random_secret_key_here

# Session secret (generate a different random string)
SESSION_SECRET=your_session_secret_key_here

# Database password (use a strong password)
POSTGRES_PASSWORD=your_secure_database_password
```

### 📁 File Upload Configuration
```bash
# Maximum file size for PDF uploads
MAX_FILE_SIZE=50MB

# User/Group IDs (for file permissions)
PUID=1000  # Your user ID
PGID=1000  # Your group ID
```

---

## 🏥 Usage Guide

### 👤 **First-Time Setup**
1. **Create Admin Account**: First user becomes admin automatically
2. **Add Institutions**: Set up your healthcare facilities
3. **Add Doctors**: Register healthcare providers
4. **Configure Lab Panels**: Set up standard lab test panels
5. **Start Adding Patients**: Begin patient management

### 📱 **Daily Operations**
- **Patient Check-in**: Create appointments, update patient records
- **Lab Report Processing**: Upload PDFs, review and correct extracted values
- **Prescription Management**: Create prescriptions during visits
- **Data Review**: Use search and filtering to find information quickly

### 🔐 **User Roles**
- **Admin**: Full access to all features, user management
- **User**: Limited to assigned patients and their data
- **Doctor**: Can be assigned to specific institutions

---

## 🔌 API Documentation

### 🏥 Core Medical Entities
```
GET|POST|PUT|DELETE /api/patients        # Patient management
GET|POST|PUT|DELETE /api/doctors         # Healthcare providers
GET|POST|PUT|DELETE /api/institutions    # Medical facilities
GET|POST|PUT|DELETE /api/appointments    # Visit scheduling
GET|POST|PUT|DELETE /api/medications     # Drug catalog
GET|POST|PUT|DELETE /api/conditions      # Medical conditions
GET|POST|PUT|DELETE /api/prescriptions   # Prescription management
```

### 🧪 Lab Reports & File Management
```
GET|POST           /api/test-results              # Lab reports list
POST               /api/test-results/upload        # PDF upload
POST               /api/test-results/:id/lab-values # Save lab values
GET                /api/test-results/:id/download  # Download PDF
GET                /api/test-results/:id/view      # View PDF inline
```

### 🔐 Authentication
```
POST               /api/auth/login                 # User login
POST               /api/auth/register              # User registration
GET                /api/auth/profile               # Current user info
```

### 🔍 System Health & Monitoring
```
GET                /api/health                     # Overall system health
GET                /api/system/database            # Database connectivity
```

---

## 📊 Database Schema

### 🗃️ Core Tables
- **`users`** - System authentication and authorization
- **`patients`** - Patient demographic and contact information  
- **`doctors`** - Healthcare provider details and specializations
- **`institutions`** - Medical facilities (hospitals, clinics, labs)
- **`appointments`** - Patient visits and consultation records
- **`medications`** - Drug catalog with JSONB active ingredients
- **`medical_conditions`** - Disease catalog with ICD codes
- **`prescriptions`** - Medications prescribed during appointments

### 🧪 Lab System Tables
- **`test_results`** - Lab reports with PDF file storage
- **`lab_values`** - Individual extracted values from reports
- **`lab_panels`** - Standard test groupings (CBC, CMP, etc.)
- **`lab_panel_parameters`** - Parameter definitions with reference ranges

### 🔑 Key Features
- **UUID primary keys** for all entities (better distribution, security)
- **JSONB columns** for flexible medication and structured data
- **Comprehensive indexing** for optimized query performance
- **Referential integrity** with proper foreign key constraints
- **Audit trails** with created_at and updated_at timestamps

---

## 🛡️ Security & Privacy

### 🔒 **Privacy Guarantees**
- ✅ **No external API calls** - All processing happens locally
- ✅ **No cloud storage** - Files stored on your local volumes
- ✅ **No telemetry** - No usage data sent anywhere
- ✅ **Local PDF processing** - Documents never leave your server
- ✅ **Complete air-gap capability** - Works without internet after setup

### 🛡️ **Security Features**
- **Parameterized queries** prevent SQL injection
- **JWT token authentication** with configurable expiration
- **Role-based access control** limits data access by user type
- **CORS configuration** prevents unauthorized frontend access
- **Input validation** and sanitization on all endpoints
- **Secure file uploads** with type and size validation

### 🔐 **Data Protection**
- **Encrypted connections** between frontend and backend
- **Secure password hashing** with industry-standard algorithms
- **Session management** with automatic timeout
- **Audit logging** for security monitoring

---

## 🚀 Performance & Monitoring

### 📈 **Built-in Monitoring**
- **Health check endpoints** for all system components
- **Database connection monitoring** with automatic retry
- **File system health checks** for upload directories
- **Application performance metrics** via health endpoints

### ⚡ **Performance Features**
- **Database indexing** on all frequently queried columns
- **Connection pooling** for optimal database performance
- **Efficient file serving** through Nginx
- **Lazy loading** and pagination for large datasets

### 📊 **Logging & Diagnostics**
- **Structured logging** with configurable levels
- **Request/response logging** for API debugging
- **Error tracking** with detailed stack traces
- **Performance logging** for slow queries and operations

---

## 🆙 Updates & Maintenance

### 🔄 **Updating Mediqux**
```bash
# Pull latest images
docker-compose pull

# Restart with new versions
docker-compose up -d

# Check update status
docker-compose logs
```

### 🗃️ **Database Backups**
```bash
# Create backup
docker exec mediqux_postgres pg_dump -U mediqux_user mediqux_db > backup.sql

# Restore backup
docker exec -i mediqux_postgres psql -U mediqux_user mediqux_db < backup.sql
```

### 📋 **System Maintenance**
```bash
# View logs
docker-compose logs -f

# Check disk usage
docker system df
docker volume ls

# Clean up old containers (careful!)
docker system prune
```

---

## 🔧 Troubleshooting

### 🐛 **Common Issues**

**Cannot connect to database:**
```bash
# Check database status
docker-compose ps postgres
docker-compose logs postgres

# Verify environment variables
cat .env
```

**File upload fails:**
```bash
# Check permissions
docker exec mediqux_backend ls -la /app/uploads

# Check disk space
df -h
```

**Frontend can't reach backend:**
```bash
# Verify API URL configuration
curl http://your-server:3000/api/health

# Check CORS settings in environment
```

### 🏥 **Health Checks**
- **System Health**: `GET /api/health`
- **Database**: `GET /api/system/database`
- **File System**: Check upload directory permissions

---

## 📄 License

**Creative Commons Attribution-NonCommercial-ShareAlike 4.0 International (CC BY-NC-SA 4.0)**

### ✅ **You are free to:**
- **Share** — copy and redistribute the material in any medium or format
- **Adapt** — remix, transform, and build upon the material

### 🔒 **Under the following terms:**
- **Attribution** — You must give appropriate credit and indicate if changes were made
- **NonCommercial** — You may not use the material for commercial purposes
- **ShareAlike** — If you remix or transform, you must distribute under the same license

**Perfect for:** Hospitals, clinics, research institutions, educational use, personal medical record keeping.

**Not for:** Commercial software companies, SaaS providers, or selling as a product.

---

## 🤝 Contributing

We welcome contributions to make Mediqux better for the healthcare community!

### 🛠️ **How to Contribute**
1. **Fork** the repository
2. **Create** a feature branch (`git checkout -b feature/amazing-feature`)
3. **Test** your changes thoroughly
4. **Commit** your changes (`git commit -m 'Add amazing feature'`)
5. **Push** to the branch (`git push origin feature/amazing-feature`)
6. **Open** a Pull Request

### 🧪 **Testing Your Changes**
```bash
# Run development environment
docker-compose -f docker-compose.dev.yml up -d

# Check health endpoints
curl http://localhost:3000/api/health
curl http://localhost:3000/api/system/database

# Test your specific changes
```

---

## 💬 Support & Community

### 🆘 **Getting Help**
1. **Check health endpoints** - `GET /api/health` for system status
2. **Review logs** - `docker-compose logs` for detailed information
3. **Check documentation** - Comprehensive guides above
4. **Community support** - [Add your support channels]

### 📢 **Stay Updated**
- ⭐ **Star** this repository for updates
- 👀 **Watch** for new releases and security updates
- 🔄 **Fork** to contribute improvements

---

## 🏥 **Built for Healthcare, By Healthcare**

Mediqux is designed specifically for healthcare environments where **data privacy**, **security**, and **local control** are paramount. Every feature is built with medical workflows in mind, ensuring your patient data remains completely under your control.

**Start your secure, local medical management system today!** 🚀

---

*Made with ❤️ for healthcare providers who value privacy and control over their data.*