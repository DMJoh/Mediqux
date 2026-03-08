# 🏥 Mediqux - Medical Record System

[![License: CC BY-NC-SA 4.0](https://img.shields.io/badge/License-CC%20BY--NC--SA%204.0-lightgrey.svg)](https://creativecommons.org/licenses/by-nc-sa/4.0/)
[![Docker](https://img.shields.io/badge/Docker-Containerized-blue)](https://docker.com)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-17-blue)](https://postgresql.org)
[![Github Actions Build](https://github.com/DMJoh/Mediqux/actions/workflows/docker-build.yml/badge.svg?event=release)](https://github.com/DMJoh/Mediqux/actions/workflows/docker-build.yml)

> **🔒 PRIVACY FIRST: All data stays on your local infrastructure. No cloud dependencies, no external API calls.**

A comprehensive medical record system for individuals and families. Built for complete local deployment with automated lab report processing.

## 📖 Table of Contents

- [Key Features](#-key-features)
- [Tech Stack](#️-tech-stack)
- [Installation](#-installation)
- [Configuration](#-configuration)
- [Screenshots](SCREENSHOTS.md)
- [Logging & Monitoring](#-logging--monitoring)
- [Updates & Maintenance](#-updates--maintenance)
- [Troubleshooting](#-troubleshooting)
- [Contributing](#-contributing)
- [Support](#-support)
- [Acknowledgments](#-acknowledgments)

## 🌟 Key Features

### 📋 **Core Medical Management**
- **Patient Records** - Complete patient information and history
- **Healthcare Providers** - Doctor and institution management  
- **Appointments** - Visit scheduling and documentation
- **Medications** - Drug database with prescription tracking
- **Medical Conditions** - Disease management with ICD codes

### 🧪 **Lab Reports (Advanced)**
- **PDF Upload** - Drag-and-drop lab report files
- **Smart Extraction** - Lab panel value detection for common panels (CBC, CMP, Lipid, etc.)
- **Review System** - Edit and verify extracted values before saving
- **Manual Entry** - Full forms for manual lab data entry
- **Secure Storage** - Files stored locally with descriptive names

### 🔐 **Privacy & Security**
- **100% Local** - No cloud services, no external APIs
- **JWT Authentication** - Secure user sessions
- **Role-based Access** - Admin and user permissions
- **Data Sovereignty** - Complete control over your medical data

## 🛠️ Tech Stack

- **Backend**: Node.js 24 LTS, Express, Sequelize ORM
- **Database**: PostgreSQL 17 with JSONB support
- **Frontend**: Vanilla JS, Bootstrap 5
- **Infrastructure**: Docker Compose

## 📋 Installation

### 🏭 Production Installation

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
# Security — change both
POSTGRES_PASSWORD=your_secure_database_password
JWT_SECRET=your_long_random_jwt_secret_key

# API URL that users' browsers will reach
BACKEND_URL=http://your-server-ip:3000/api

FRONTEND_DOCKER_PORT=8080
BACKEND_DOCKER_PORT=3000

MAX_FILE_SIZE=10MB
PUID=1000
PGID=1000
```

> If the app loads but shows errors or can't connect, see the [URL & port configuration guide](https://github.com/DMJoh/Mediqux/wiki/Configuring-URL-&-Ports).

**Step 3: Deploy**
```bash
# Start all services (migrations run automatically)
docker compose up -d

# Check deployment status
docker compose ps
docker compose logs
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

# Start development environment (migrations run automatically)
docker compose -f docker-compose.dev.yml up -d

# The system will build from source code and run migrations
```

## 🔧 Configuration

### Environment Variables
```bash
# Security
JWT_SECRET=your_very_long_random_secret_key_here
POSTGRES_PASSWORD=your_secure_database_password

# API URL that users' browsers will reach
# (port must match BACKEND_DOCKER_PORT for direct access)
BACKEND_URL=http://your-server-ip:3000/api

# Ports Docker exposes on your host machine
FRONTEND_DOCKER_PORT=8080
BACKEND_DOCKER_PORT=3000

# File Uploads
MAX_FILE_SIZE=50MB

# User Permissions
PUID=1000
PGID=1000

# Logging
LOG_LEVEL=INFO  # Options: ERROR, WARN, INFO, DEBUG
```

## 📊 Logging & Monitoring

```bash
# View logs
docker compose logs -f backend

# Parse JSON logs with jq
docker compose logs backend | jq

# Filter by log level
docker compose logs backend | jq 'select(.level=="ERROR")'

# Enable debug logging
LOG_LEVEL=DEBUG docker-compose up -d

# System health
curl http://localhost:3000/api/health
curl http://localhost:3000/api/system/database
```

## 🔄 Updates & Maintenance

```bash
# Update to latest version
docker compose pull
docker compose up -d

# Database backup
docker exec mediqux_postgres pg_dump -U mediqux_user mediqux_db > backup.sql

# Database restore
docker exec -i mediqux_postgres psql -U mediqux_user mediqux_db < backup.sql

# Check migration status
docker exec mediqux_backend npm run db:migrate:status
```

## 🔧 Troubleshooting

**Cannot connect to database:**
```bash
docker compose ps postgres
docker compose logs postgres
```

**File upload fails:**
```bash
docker exec mediqux_backend ls -la /app/uploads
```

**Frontend can't reach backend:**
```bash
curl http://your-server:3000/api/health
```

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Test thoroughly
4. Submit a Pull Request

## 💬 Support

- **Health Endpoints**: `/api/health` for system status
- **Logs**: `docker-compose logs` for detailed information
- **Community**: [GitHub Issues](https://github.com/DMJoh/Mediqux/issues)

---
## 🙏 Acknowledgements

Built with these excellent open-source technologies:

- **[Node.js](https://nodejs.org/)** & **[Express.js](https://expressjs.com/)** - Server runtime and web framework
- **[PostgreSQL](https://www.postgresql.org/)** & **[Sequelize](https://sequelize.org/)** - Database and ORM
- **[Docker](https://www.docker.com/)** - Containerization platform
- **[Bootstrap](https://getbootstrap.com/)** - Responsive UI framework
- **[PDF-Parse](https://www.npmjs.com/package/pdf-parse)** - Local PDF processing
- **[bcrypt](https://www.npmjs.com/package/bcrypt)** & **[JWT](https://jwt.io/)** - Security and authentication
- **[Claude Code](https://claude.ai/code)** - AI development assistance

Special thanks to the open-source community for enabling privacy-focused, locally-hosted healthcare solutions.



**Built for privacy-first medical record management.** 🏥

*Made with ❤️ by developers who believe in data sovereignty.*

---

## 📝 A Note from the Developer

Mediqux was built to solve a real personal need - a private, self-hosted place to manage medical records, appointments, lab results, and diagnostic studies for my family. I couldn't find anything that fit, so I built it.

This project was developed with the help of AI coding assistance. The idea, requirements, and design decisions are entirely mine, the AI helped bring them to life in code.

I'm sharing this in case it's useful to others. If you use it and find a bug or have a suggestion, feel free to open an issue.

> **Please note:** This is a personal project shared as-is. Review and assess it for your own needs before using it in any sensitive or clinical context.
