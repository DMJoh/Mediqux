<p align="center">
  <img src=".github/logo.svg" width="88" alt="Mediqux logo" />
</p>

<h1 align="center">Mediqux</h1>

<p align="center">
  A self-hosted medical record system for individuals and families.
</p>

<p align="center">
  <a href="https://www.gnu.org/licenses/agpl-3.0"><img src="https://img.shields.io/badge/License-AGPL%20v3-blue.svg" alt="License: AGPL v3" /></a>
  <a href="https://docker.com"><img src="https://img.shields.io/badge/Docker-Containerized-blue" alt="Docker" /></a>
  <a href="https://postgresql.org"><img src="https://img.shields.io/badge/PostgreSQL-17-blue" alt="PostgreSQL" /></a>
  <a href="https://github.com/DMJoh/Mediqux/releases"><img src="https://img.shields.io/github/v/release/DMJoh/Mediqux" alt="GitHub Release" /></a>
  <a href="https://github.com/DMJoh/Mediqux/actions/workflows/docker-build.yml"><img src="https://github.com/DMJoh/Mediqux/actions/workflows/docker-build.yml/badge.svg?event=release" alt="Build" /></a>
</p>

Patients, doctors, appointments, prescriptions, lab reports, and diagnostic studies, all in one place, running entirely on your own infrastructure.

> All data stays on hardware you control. No cloud dependency, no external API calls, no telemetry.

## Features

- **Patient records**: contact details, history, and every related appointment, prescription, lab report, and diagnostic study in one view.
- **Providers**: doctors and institutions, linked to the appointments and prescriptions they're involved in.
- **Appointments & prescriptions**: visit scheduling, diagnosis notes, and medication tracking with per-prescription status.
- **Lab reports**: upload a PDF, or enter results manually against reusable reference panels.
- **Diagnostic studies**: imaging and other study files, linked to the patient, doctor, and institution.
- **Multi-patient accounts**: one login can be scoped to several patients, for a family sharing a single account.
- **Role-based access**: admin and user roles. Non-admin accounts only ever see the patients they're linked to, enforced on both reads and writes.
- **Single exposed port**: Caddy fronts the app and proxies API/upload requests internally. Nothing else is reachable from outside the container network.

## Tech stack

| | |
|---|---|
| Backend | Node.js, Express, PostgreSQL (via `pg`) |
| Frontend | React, Vite, Tailwind CSS, TanStack Query, Radix UI |
| Reverse proxy | Caddy |
| Deployment | Docker Compose |

## Quick start

```bash
mkdir mediqux && cd mediqux

curl -O https://raw.githubusercontent.com/DMJoh/Mediqux/refs/heads/main/docker-compose.yml
curl -o .env https://raw.githubusercontent.com/DMJoh/Mediqux/refs/heads/main/.env.example
```

Edit `.env`. At minimum, change `POSTGRES_PASSWORD` and `JWT_SECRET`, and set `APP_PORT` to whatever host port you want the app on:

```bash
POSTGRES_PASSWORD=your_secure_database_password  # generate with: openssl rand -hex 32
JWT_SECRET=your_long_random_jwt_secret_key  # generate with: openssl rand -hex 32
APP_PORT=8080
```

Then bring it up:

```bash
docker compose up -d
```

Open `http://your-server:APP_PORT`. On a fresh install you'll land on a setup screen to create the admin account. After that, additional accounts are created by an admin from the Users page, not via open signup.

### Development

```bash
git clone https://github.com/DMJoh/Mediqux.git
cd Mediqux
cp .env.example .env
docker compose -f docker-compose.dev.yml up -d
```

## Configuration

Everything lives in `.env`. The essentials:

```bash
POSTGRES_PASSWORD=change_this_secure_password_123  # generate with: openssl rand -hex 32
JWT_SECRET=change_this_jwt_secret_key_for_production_use_long_random_string  # generate with: openssl rand -hex 32
APP_PORT=8080
MAX_FILE_SIZE=10MB
PUID=1000
PGID=1000
LOG_LEVEL=info  # error, warn, info, debug
```

Caddy proxies `/api` and `/uploads` to the backend internally, so `APP_PORT` is the only port you expose. The backend itself is never reachable from the host directly.

### Running behind your own reverse proxy

If you're putting Traefik, Nginx Proxy Manager, a Cloudflare Tunnel, or anything else in front of Mediqux's own Caddy, there are now two proxy hops between a visitor and the backend instead of one. Set `TRUST_PROXY_HOPS` so rate limiting can identify real visitors instead of treating your proxy as every visitor:

```bash
TRUST_PROXY_HOPS=2
```

Leave it unset if Mediqux's bundled Caddy is the only thing in front of it. That's the default setup for most installs.

## Operations

```bash
# Logs
docker compose logs -f backend

# Health
curl http://localhost:8080/api/health
curl http://localhost:8080/api/system/database

# Update
docker compose pull && docker compose up -d

# Backup / restore
docker exec mediqux_postgres pg_dump -U mediqux_user mediqux_db > backup.sql
docker exec -i mediqux_postgres psql -U mediqux_user mediqux_db < backup.sql

# Migration status
docker exec mediqux_backend npx sequelize-cli db:migrate:status
```

## Troubleshooting

**Database won't connect**
```bash
docker compose ps postgres
docker compose logs postgres
```

**File upload fails**
```bash
docker exec mediqux_backend ls -la /app/uploads
```

**Frontend can't reach backend**: the backend's port isn't published to the host, only Caddy is. Check the internal connection instead:
```bash
docker compose logs frontend
docker exec mediqux_frontend wget -qO- http://backend:3000/api/health
```

## Contributing

Fork, branch, make your change, open a PR. Issues and suggestions are welcome even if you're not submitting code.

## Acknowledgements

Built on [Node.js](https://nodejs.org/), [Express](https://expressjs.com/), [PostgreSQL](https://www.postgresql.org/), [React](https://react.dev/), [Vite](https://vite.dev/), [Tailwind CSS](https://tailwindcss.com/), [TanStack Query](https://tanstack.com/query/), [Radix UI](https://www.radix-ui.com/), [Caddy](https://caddyserver.com/), and [Docker](https://www.docker.com/).

## License

[AGPLv3](https://www.gnu.org/licenses/agpl-3.0). Free to use, modify, and self-host. If you run a modified version as a network service, you must make that version's source available to its users under the same license.

## About this project

I built Mediqux because I wanted a private, self-hosted place to track medical records, appointments, lab results, and diagnostic studies for my family, and couldn't find one that fit. The idea, requirements, and design decisions are mine; AI tooling helped write the code.

Sharing it in case it's useful to you too. Open an issue if something's broken or missing.

> This is a personal project shared as-is. Review it against your own needs before relying on it for anything sensitive or clinical.
