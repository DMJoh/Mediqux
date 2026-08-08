# Changelog

All notable changes to Mediqux will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.0.13] - 2026-08-09

### 🐛 Bug Fixes

- **Lab report Appointment link was silently dropped** — Manual Entry's save payload never included `appointment_id`, so linking a lab report to an appointment via the "Related Appointment" dropdown had no effect on create *or* edit; the backend `PUT /:id` route didn't even accept the field. Fixed on both ends.
- **Edit didn't restore the selected Appointment** — Editing a report set the Patient dropdown's value directly (not via a real selection), which never triggered the listener that populates the Appointment dropdown's options, so it was always empty and unselected regardless of what was actually saved. Fixed by explicitly reloading appointment options for the report's patient before selecting the saved one.
- **View modal was missing Institution, Performed By, Appointment, and the PDF link** — these were saved and available from the API but never rendered in the "View Details" modal, making it look like they hadn't been saved at all. Now displayed alongside test date/type and lab values.
- **Patient view showed the wrong emergency contact field** — the View Details modal checked a `patient.emergency_contact` field that doesn't exist (the real columns are `emergency_contact_name`/`emergency_contact_phone`), so a correctly-saved emergency contact never appeared in View, only in Edit.
- **Condition view never showed the ICD code** — same class of bug: the View modal checked `condition.icd_10_code`, but the actual field (used everywhere else — list, edit, save) is `icd_code`.
- **Medication view never showed Dosage Forms or Strengths, and Active Ingredients rendered as `[object Object]`** — the View modal checked singular `medication.dosage_form`/`medication.strength` instead of the real plural array fields `dosage_forms`/`strengths`, and rendered each active-ingredient object directly instead of its `name`/`dosage` properties.
- **Prescription status could get silently stuck** — three compounding bugs in the same area: (1) `PUT /prescriptions/:id` only pushed a status change into `patient_medications` when the new status wasn't "Active", so reverting a prescription back to Active from Discontinued/Completed silently did nothing; (2) that update also assumed a `patient_medications` row already existed and did nothing if it didn't (true for prescriptions that predate that tracking, e.g. seed data) — now upserts; (3) `GET /prescriptions/:id` returned the status under the wrong field name (`medication_status` instead of `status`), so the Edit form and View modal always showed "Active" regardless of the real saved status. All three fixed together since they masked each other.

### ✨ Added

- **Quick-add from Lab Panels in Manual Entry** — The Manual Entry form's quick-add buttons are now generated from your actual Lab Panels (Manage Panels) instead of a fixed hardcoded list. Selecting a panel pre-fills parameter name, unit, and reference range (derived from the panel's min/max) for each of its parameters, leaving the value blank for you to fill in. Closes the previous gap where Lab Panels and manual entry were disconnected features.
- **Optional Lab Panel + values on PDF upload** — The Upload PDF modal now has an optional "Lab Panel" dropdown; selecting one pre-fills the test name (if blank) and the panel's parameters below, which you can fill in immediately or leave for later (via Edit). Values are only saved if at least one row is filled in — the PDF upload itself is unaffected either way.

### 🔥 Removed

- **Automatic lab value extraction removed** — Uploading a lab report PDF no longer attempts to parse or pattern-match values out of the document. Lab report formats vary too much across labs and countries to generalize reliably with pattern matching, and in practice the extracted values still needed manual review and correction most of the time — so the automation added more overhead than it saved. PDFs are stored as-is; use **Manual Entry** to record lab values, or the **Lab Panels** reference-range feature to define reusable panels. This removes the `pdf-parse` dependency, the pattern-matching/confidence-scoring logic in `test-results.js`, and the "review extracted values" UI (part of which was already unreachable dead code). The `extracted_text`/`structured_data` columns on `test_results` are left in place (unused) — no migration needed.

## [1.0.12] - 2026-06-26

### 🔒 Security (CodeQL)

- **UUID validation on route params** — `:id` parameters in appointments, prescriptions, diagnostic-studies, and test-results routes are now validated as well-formed UUIDs before reaching the DB; malformed values return `400` (CodeQL #4, #5, #6, #7, #8, #50)
- **JWT payload no longer trusted for identity** — `authenticateToken` now sources `id`, `username`, and `role` from the DB row rather than the decoded token, preventing identity spoofing via crafted JWTs; `/api/auth/me` simplified to use the same middleware (CodeQL #55, #56, #57)
- **Rate limiting gaps closed** — `/api/health` and `/api/system/database` were missing `apiLimiter`; both now enforce the standard 300 req / 15-min limit

### 🐛 Bug Fixes

- **Appointment diagnosis not saved on creation** — `POST /appointments` was missing `diagnosis` in the destructure and `INSERT`, so it was silently dropped for new completed appointments
- **Appointment diagnosis not shown in view modal** — `displayAppointmentDetails` never rendered the `diagnosis` field; now conditionally shown in the view modal

### 🧪 Testing

- **Expanded coverage** — 334 lines of additional tests across appointments, auth, diagnostic-studies, prescriptions, test-results, and logger; includes UUID validation edge cases and the diagnosis persistence path

### 🔁 CI / CD

- **CodeQL workflow added** — Runs on push/PR to `main`; trigger scoped to `main` only to skip redundant scans on feature branches
- **SonarQube trigger corrected** — Fixed scan conditions so the workflow fires on the correct branches

---

## [1.0.11] - 2026-06-12

### 🔒 Security Hardening

This release is a focused security and quality release. No schema migrations.

#### Rate Limiting
- **Auth route limiting** — Login and registration endpoints now enforce a limit of 20 requests per 15-minute window per IP, preventing brute-force attacks
- **API route limiting** — All API endpoints are capped at 300 requests per 15-minute window, mitigating denial-of-service via excessive polling
- Added `express-rate-limit` as a production dependency; limits return standard `RateLimit-*` headers (RFC 6585 compliant)

#### Path Traversal Prevention
- **File deletion handlers hardened** — Upload deletion in both lab reports and diagnostic studies now validates that the resolved file path stays within the `/uploads/` directory before unlinking, preventing directory traversal attacks where a crafted path could delete arbitrary files on the host

#### XSS Prevention
- **HTML sanitization in delete buttons** — Condition, institution, medication, and other entity names are now HTML-escaped via `data-*` attributes before being injected into delete button `onclick` handlers, preventing stored XSS through entity names containing `<script>` or event handler payloads

#### ReDoS Prevention (S5852)
- **Lab report regex patterns refactored** — Regex patterns used for extracting CBC, CMP, and other lab values from PDF text no longer use unbounded `.*` with the `s` (dotAll) flag in patterns that scan across line boundaries. Replaced with `[^\r\n]{0,100}?` bounded alternatives, eliminating catastrophic backtracking risk on malformed input

#### Cryptography (S2245)
- **File upload name generation** — Both test-results and diagnostic-studies routes explicitly import `randomBytes` from `node:crypto` (built-in module path), removing any ambiguity about which `crypto` implementation is in use

#### Hardcoded Credential / IP Removal (S5332)
- **Frontend fallback API URL removed** — `frontend/js/config.js` previously fell back to a hardcoded private IP (`192.168.10.50:3000`) when `MEDIQUX_API_URL` was not injected at container startup. This is now replaced with a relative `/api` path, which works correctly in all standard deployment configurations and does not leak internal network topology

### 🐛 Bug Fixes

- **Appointment deletion now blocked when test results exist** — Attempting to delete an appointment that has linked lab reports previously caused a database foreign key error. The API now returns a clean `409 Conflict` with an explanatory message: _"Cannot delete appointment: it has linked test results. Remove the test results first."_
- **Uploaded file attachments now load correctly via nginx** — PDF reports and diagnostic study attachments were unreachable in production because the nginx frontend container had no rule to forward `/uploads/` requests to the backend. Added a dedicated `location /uploads/` proxy block in `nginx-template.conf`

### 🧪 Testing

- **Full backend unit test suite introduced** — 3,755 lines of Jest tests across 14 files covering all routes and middleware:
  - Auth middleware (JWT validation, RBAC, patient filter)
  - All route handlers: auth, patients, doctors, institutions, appointments, conditions, medications, prescriptions, test results, diagnostic studies, users
  - Logger utility
- **Jest configuration** — `jest.config.js` with coverage reporting (lcov + text), test environment isolation via a shared `createApp.js` helper and `setup.js` that mocks Sequelize and DB modules
- **Coverage piped to SonarQube** — CI workflow now runs tests with `--coverage` before the Sonar scan and passes the `lcov.info` report path to the scanner

### 🔍 Static Analysis (SAST)

- **SonarQube scanning integrated** — New `.github/workflows/sonar-scan.yml` runs on every push to `main` and `develop`. Scans backend source with `sonar-project.properties` configuration
- **Minimal CI token permissions** — `GITHUB_TOKEN` in the Sonar workflow is scoped to `contents: read` only, following least-privilege practice

### 🐳 Infrastructure

#### Base Image Migration: Alpine → Debian Slim
- **`node:24-alpine` replaced with `node:24-slim`** across all Dockerfile stages — Alpine's musl libc can trigger `SIGILL` (illegal instruction) on certain x86 CPUs that lack AVX2 support. Debian slim uses glibc, which is broadly compatible
- **Package manager updated** — Build dependencies now installed via `apt-get` instead of `apk`
- **`su-exec` replaced with `gosu`** — Alpine-specific privilege-dropping utility swapped for the Debian-compatible equivalent; `entrypoint.sh` updated accordingly (`addgroup`/`adduser` → `groupadd`/`useradd`, `su-exec` → `gosu`)
- **Dependabot locked to Node LTS** — Dependabot is now configured to ignore odd-numbered (non-LTS) node base image versions (21, 23, 25, 27, 29) to prevent automatic upgrades to unstable releases

### 📦 Dependency Updates

| Package | From | To | Notes |
|---|---|---|---|
| `bcryptjs` | 2.4.3 | 3.0.3 | Security update (Dependabot) |
| `pg` | 8.18.0 | 8.20.0 | Minor — connection improvements |
| `multer` | 2.0.2 | 2.1.1 | Minor |
| `dotenv` | 17.2.3 | 17.3.1 | Minor |
| `sequelize` | 6.37.7 | 6.37.8 | Patch |
| `docker/build-push-action` | 6 | 7 | CI action |
| `docker/login-action` | 3 | 4 | CI action |
| `docker/setup-buildx-action` | 3 | 4 | CI action |
| `docker/metadata-action` | v5 | v6 | CI action |

---

## [1.0.10] - 2026-03-08

### ⚠️ Before Upgrading

**Take a full backup before upgrading to this version.** This release includes database migrations that alter the schema.

Before pulling the new images and restarting, please back up your PostgreSQL database and the uploads volume. Migrations are non-destructive (additive only) and existing data will not be affected, but a backup is strongly recommended before any upgrade.

### New Features

#### 🩻 Diagnostic Studies Module
- **New Diagnostic Studies section** — Dedicated module for medical imaging and studies (MRI, CT Scan, X-Ray, Ultrasound, Echography, PET Scan, Mammography, Bone Densitometry, Endoscopy, and others)
- **Ordering & Performing Physician fields** — Track both the requesting doctor and the radiologist/performing physician per study
- **File attachment support** — Upload PDF reports or image files (JPG/PNG) up to 20MB per study
- **Authenticated file viewing** — Attachments served via authenticated API endpoint (blob URL pattern).
- **Stats dashboard** — Summary cards showing total studies, recent studies, study type breakdown
- **Search & filter** — Filter by study type with live count badge
- **Full CRUD** — Add, edit, view detail, and delete studies with confirmation

#### 🔬 Performed By field on Lab Reports
- **Performed By doctor field** — Added to both PDF upload and manual entry modals for recording the biochemist or lab technician who performed the test
- **Displayed in lab report details** — Performing doctor shown alongside other report metadata

#### 🗂 Records Navigation Dropdown
- **Consolidated Records menu** — Replaced flat "Lab Reports" nav link with a "Records" dropdown grouping Lab Reports and Diagnostic Studies across all pages

### 🔧 Technical Improvements
- Added Sequelize migration for `diagnostic_studies` table with FKs to patients, doctors (ordering + performing), and institutions
- Added Sequelize migration to add nullable `performed_by_id` column to `test_results`
- Backend diagnostic studies route uses `CASE WHEN` pattern for nullable JSON physician/institution objects (PostgreSQL `FILTER` clause is aggregate-only)
- `frontend/js/runtime-config.js` removed from git tracking — file is generated at container startup by `frontend/docker-entrypoint.sh`
- Removed redundant plain SQL files from `backend/migrations/` — all schema managed by Sequelize migrations in `backend/src/migrations/`
- Improved `.env.example` documentation with clearer guidance on direct access vs reverse proxy URL configuration 
- Removed deprecated `FRONTEND_URL` variable

---

## [1.0.8] - 2025-10-02

### ⚠️ BREAKING CHANGES

**Environment variable structure simplified for better reverse proxy support.**

#### Migration Required

**Removed:** `BACKEND_HOST`, `BACKEND_PORT`, `FRONTEND_HOST`, `FRONTEND_PORT`
**Added:** `BACKEND_URL`, `FRONTEND_URL`, `BACKEND_DOCKER_PORT`, `FRONTEND_DOCKER_PORT`
**Optional:** `CORS_ORIGIN` (FRONTEND_URL is auto-allowed)

**Migration:**
```bash
# OLD → NEW
BACKEND_HOST=192.168.1.100  → BACKEND_URL=http://192.168.1.100:3000/api
BACKEND_PORT=3000           → BACKEND_DOCKER_PORT=3000
FRONTEND_HOST=192.168.1.100 → FRONTEND_URL=http://192.168.1.100:8080
FRONTEND_PORT=8080          → FRONTEND_DOCKER_PORT=8080
```

**Why:** Full URLs support custom domains, HTTPS, and path-based routing. Fixes reverse proxy scenarios.

### 🐛 Bug Fixes
- Fixed ERR_BLOCKED_BY_CLIENT errors from strict CORS policy
- Multi-origin CORS support (localhost, 127.0.0.1, configured URLs)
- Port normalization for 80/443
- Ad blocker compatibility (renamed `/auth/check-setup` to `/auth/initial-config`)

### 🔧 Technical Improvements
- Automatic CORS from FRONTEND_URL (both HTTP/HTTPS)
- Simplified configuration (no manual CORS setup needed)
- Updated docker-compose.yml and .env.example
- Multi-origin support only allows explicitly configured origins
- CORS error visibility with proper logging

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