# 🏥 Mediqux - Medical Record System

[![License: CC BY-NC-SA 4.0](https://img.shields.io/badge/License-CC%20BY--NC--SA%204.0-lightgrey.svg)](https://creativecommons.org/licenses/by-nc-sa/4.0/)
[![Docker](https://img.shields.io/badge/Docker-Containerized-blue)](https://docker.com)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-17-blue)](https://postgresql.org)

> **🔒 PRIVACY FIRST: Mediqux is designed to run entirely on your local infrastructure. No data leaves your environment - all processing, storage, and PDF analysis happens locally on your servers.**

A comprehensive, privacy-focused medical record system for individuals, families, and healthcare practices. Built for complete local deployment with no external dependencies or cloud services.

## 🌟 Why Mediqux?

### 🔐 **100% Local & Private**
- **No cloud dependencies** - Everything runs on your infrastructure
- **Local PDF processing** - Lab reports analyzed offline using local libraries
- **Complete data sovereignty** - Your medical data never leaves your premises
- **No internet required** for core functionality (only for initial setup)

### 🏠 **Flexible Health Management**
- **Personal Use**: Perfect for individuals and families managing their own health records
- **Clinical Use**: Ideal for small clinics, private practices, and independent healthcare providers
- **Complete Privacy**: Designed for maximum data control whether at home or in practice
- **Scalable**: Works equally well for single users or small healthcare teams

## 📸 Screenshots

**[View Application Screenshots →](SCREENSHOTS.md)**

See the complete user interface with screenshots of all major features and pages.

---

## 🚀 Features

### 👥 **Patient & Provider Management**
- **Patient Records**: Track medical records for individuals, family members, or clinic patients
- **Healthcare Providers**: Manage doctors, specialists, and healthcare professional information
- **Medical Facilities**: Track hospitals, clinics, labs, and healthcare institutions
- **Provider Networks**: Organize healthcare teams and their professional relationships

### 📅 **Appointment & Visit Management**
- **Appointment Scheduling**: Track medical appointments and visits for personal or clinical use
- **Visit Types**: Consultation, Follow-up, Emergency, Surgery, Therapy
- **Visit History**: Maintain detailed records of all medical encounters
- **Clinical Documentation**: Record visit details, diagnoses, treatment plans, and outcomes

### 💊 **Medication & Prescription Management**
- **Comprehensive Drug Database**: Medication catalog with active ingredients and detailed information
- **Prescription Management**: Track prescriptions for personal use or clinical practice
- **Medication History**: Monitor current and past medications with dosages and interactions
- **Treatment Integration**: Connect medications to specific visits, conditions, and treatment plans
- **Advanced Search**: Find medications by name, generic name, or active ingredients

### 🏷️ **Medical Conditions & Diagnoses**
- **Condition Management**: Track medical conditions and diagnoses for personal or clinical use
- **ICD Code Support**: International Classification of Diseases coding for medical accuracy
- **Clinical Organization**: Organize by medical specialty, body system, and severity
- **Progress Monitoring**: Track condition severity and progression over time
- **Treatment Integration**: Link conditions to medications, treatments, and outcomes

### 🧪 **Laboratory Results Management**
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

### 🔐 **Privacy & Security**
- **Secure Login**: JWT-based authentication for your personal data
- **Multi-User Support**: Family members can have separate accounts with access controls
- **Data Privacy**: Each user only sees their own medical records
- **Session Security**: Automatic logout for data protection
- **Password Protection**: Secure password hashing and validation

### 🎨 **User Experience**
- **Responsive Design**: Mobile-friendly Bootstrap 5 interface
- **Dark/Light Theme**: Toggle between themes with persistent user preference
- **Intuitive Navigation**: Clean, user-friendly interface designed for personal use
- **Advanced Search & Filtering**: Quick access to your medical records and data
- **Real-time Health Monitoring**: System status and component health checks

### 📊 **Personal Health Analytics**
- **Health Dashboard**: Overview of your recent activities and health metrics
- **Health Statistics**: Appointment history, medication tracking, lab trends
- **Lab Trend Analysis**: Track your lab results over time
- **Export Capabilities**: Generate reports and export your medical data

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
curl -O https://raw.githubusercontent.com/DMJoh/Mediqux/refs/heads/main/docker-compose.yml

# Download environment template directly as .env
curl -o .env https://raw.githubusercontent.com/DMJoh/Mediqux/refs/heads/main/.env.example
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

## 🏠 Usage Guide

### 👤 **First-Time Setup**

**For Personal Use:**
1. **Create Your Account**: Set up your personal/family medical record system
2. **Add Family Members**: Create records for family members you'll be managing
3. **Add Healthcare Providers**: Enter your doctors, specialists, and healthcare team
4. **Add Medical Facilities**: Record hospitals, clinics, and labs you visit
5. **Configure Lab Panels**: Set up common lab tests and panels you receive

**For Clinical Use:**
1. **Admin Setup**: Create administrative account for practice management
2. **Staff Accounts**: Set up accounts for healthcare staff with appropriate permissions
3. **Provider Profiles**: Add doctor and specialist information for your practice
4. **Facility Information**: Configure your clinic/practice details and partner facilities
5. **Standard Panels**: Set up commonly ordered lab panels and test templates

### 📱 **Daily Operations**

**Personal Use:**
- **Track Appointments**: Record your medical visits, outcomes, and follow-ups
- **Lab Management**: Upload and organize your lab reports with automated processing
- **Medication Tracking**: Maintain comprehensive prescription and medication records
- **Health Analytics**: Review health trends and search through your complete medical history

**Clinical Use:**
- **Patient Management**: Schedule appointments, document visits, track patient care
- **Clinical Documentation**: Record diagnoses, treatment plans, and patient progress
- **Lab Integration**: Process patient lab results with automated value extraction
- **Practice Analytics**: Monitor clinic operations, patient trends, and health outcomes

### 🔐 **Access Control**

**Personal/Family Mode:**
- **Primary User**: Full access to manage all family medical records
- **Family Members**: Individual accounts with access to their own health data
- **Shared Access**: Controlled sharing of medical information between family members

**Clinical Mode:**
- **Administrators**: Full practice management and user administration capabilities
- **Healthcare Staff**: Role-based access to patient records and clinical features
- **Patient Privacy**: Strict data segregation ensuring patient confidentiality

---

## 🔌 API Documentation

### 🏠 Core Medical Records API
```
GET|POST|PUT|DELETE /api/patients        # Patient records (personal/family or clinical)
GET|POST|PUT|DELETE /api/doctors         # Healthcare provider management
GET|POST|PUT|DELETE /api/institutions    # Medical facility information
GET|POST|PUT|DELETE /api/appointments    # Your appointment history
GET|POST|PUT|DELETE /api/medications     # Personal medication database
GET|POST|PUT|DELETE /api/conditions      # Your health conditions
GET|POST|PUT|DELETE /api/prescriptions   # Prescription tracking
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

**Perfect for:** Personal medical record keeping, family health tracking, small clinics, private practices, independent healthcare providers, educational use.

**Not for:** Commercial software companies, SaaS providers, or selling as a product.

---

## 🤝 Contributing

We welcome contributions to make Mediqux better for health record management in personal and clinical settings!

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

## 🏠 **Built for Privacy-First Health Management**

Mediqux is designed for anyone who values **complete control** over medical records. Whether you're an individual managing your family's health data at home, or a healthcare provider running a privacy-focused practice, every feature is built with maximum data sovereignty in mind.

**Perfect for:**
- 👨‍👩‍👧‍👦 **Individuals & Families**: Complete control over your personal health records
- 🩺 **Small Clinics & Private Practices**: Privacy-focused patient management
- 👨‍⚕️ **Independent Healthcare Providers**: Professional-grade medical record system
- 🎓 **Educational Use**: Medical training and health informatics learning

**Start your secure, local medical record system today!** 🚀

---

## 🙏 Acknowledgments

We extend our gratitude to the following projects, communities, and tools that made Mediqux possible:

### **Core Technologies**
- **[Node.js](https://nodejs.org/)**: JavaScript runtime enabling scalable server-side development
- **[PostgreSQL](https://www.postgresql.org/)**: Advanced open-source relational database system providing robust data management
- **[Express.js](https://expressjs.com/)**: Fast, minimalist web framework for Node.js
- **[Bootstrap](https://getbootstrap.com/)**: Responsive CSS framework for modern web interfaces

### **Development & Infrastructure**
- **[Docker](https://www.docker.com/)**: Containerization platform enabling consistent deployment across environments
- **[PDF-Parse](https://www.npmjs.com/package/pdf-parse)**: Pure JavaScript PDF parsing library for local document processing

### **Development Assistance**
- **[Claude Code](https://claude.ai/code)**: AI-powered development assistant for code generation, architecture design, security analysis, and comprehensive documentation

### **Security & Authentication**
- **[bcrypt](https://www.npmjs.com/package/bcrypt)**: Industry-standard password hashing library
- **[JSON Web Tokens (JWT)](https://jwt.io/)**: Secure token-based authentication standard

### **Community & Open Source**
Special thanks to the open-source community for providing the foundational tools and libraries that enable privacy-focused, locally-hosted healthcare solutions. This project stands on the shoulders of countless contributors who believe in accessible, secure technology.

---

*Made with ❤️ for everyone who values privacy and control over their health data.*