# Mediqux Frontend

React + Vite + Tailwind CSS v4, replacing the previous vanilla JS/Bootstrap frontend (kept for reference in `../frontend-legacy/` until the rewrite is complete).

Stack: React 19, React Router, TanStack Query for API data, Radix UI primitives for accessible dialogs/menus, lucide-react for icons.

Design system: "Glass Aurora" — dark glassmorphism with a magenta→blue gradient accent, defined as Tailwind theme tokens in `src/index.css`.

## Local development

```bash
npm install
npm run dev
```

Or via Docker (matches the `frontend` service in `docker-compose.dev.yml`):

```bash
docker compose -f ../docker-compose.dev.yml up frontend
```

`MEDIQUX_API_URL` (env var) sets the backend API base URL at container start — written to `public/runtime-config.js` by `docker-entrypoint.dev.sh`, read by `src/lib/api.js`.

## Structure

- `src/lib/api.js` — fetch wrapper (auth header, retry, error unwrapping)
- `src/lib/auth.jsx` — auth context (login/signup/logout, silent token refresh)
- `src/lib/queries.js` — TanStack Query hooks per API resource
- `src/components/layout/` — `AppShell` (sidebar + topbar) and `ProtectedRoute`
- `src/pages/` — one file per route; most are still `ComingSoon` placeholders pending port from `frontend-legacy/js/*.js`
