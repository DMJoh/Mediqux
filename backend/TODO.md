# Backend cleanup TODO

Findings from a multi-angle code review of the backend diff (frontend-legacy findings excluded — that code is being retired, not maintained).

## Before deploying this release

This release includes real schema changes: `20260903000001-add-prescription-id-to-patient-medications.js` (additive, nullable column) and `20260903000002-add-unique-prescription-id-index.js` (a partial unique index on that same column) — see the `patient_medications` sections below. Both are additive/non-destructive, but back up the database before upgrading regardless:

```bash
docker exec mediqux_postgres pg_dump -U mediqux_user mediqux_db > backup.sql
```

Then `docker compose up -d` (runs pending migrations automatically) or `npm run db:migrate` directly.

## RBAC: write-side patient-scoping — fixed

Fixed. Every write endpoint below now checks `patientFilterAllows(req.patientFilter, patientId)` before allowing the mutation, mirroring the pattern `diagnostic-studies.js` already used:

- `appointments.js` `POST /`, `PUT /:id`, `DELETE /:id` — ownership checked against the target/existing row's `patient_id`.
- `test-results.js` `POST /upload`, `POST /:id/lab-values`, `POST /`, `PUT /:id`, `DELETE /:id` — all now actually read `req.patientFilter` instead of just having the middleware wired in decoratively.
- `prescriptions.js` `POST /`, `PUT /:id`, `DELETE /:id` — same gap existed here too (not originally listed above, found during the same pass) and is fixed identically, resolving ownership via the linked appointment's `patient_id`.
- `patients.js` `PUT /:id`/`DELETE /:id` — audited and fixed; a scoped user can now only edit/delete their own linked patient record.

Test coverage added for every new 403/404 ownership-denial path across `tests/routes/{appointments,prescriptions,test-results,patients}.test.js`. Full suite (`npm test`) is green: 426/426 (after all fixes below).

## Bugs — fixed

- **`src/routes/diagnostic-studies.js`** — `logger` is now imported; the `PUT`/`DELETE` attachment-unlink failure path no longer risks a `ReferenceError`.
- **`src/middleware/auth.js`** — missing-token detection restored to an explicit `if (!token)` 401 guard ahead of `jwt.verify`, and the catch block now branches on `error.name === 'TokenExpiredError'` (returning `{ error: 'Token expired', expired: true }`) instead of matching an undocumented `jsonwebtoken` error-message string.
- **`POST /api/auth/refresh`** — the frontend's silent-refresh loop (`frontend/src/lib/auth.jsx`) fires every 20 minutes against a 24h token, well before expiry, so `/refresh` failing on an already-expired token is expected/by-design, not a bug — the real problem was the 403 being indistinguishable from "invalid token"; that's fixed by the `expired: true` flag above.

## `patient_medications` upsert semantics — fixed

Was keyed only on `(patient_id, medication_id)`, so two separate prescriptions of the same medication for one patient collided on a single shared status row — editing either one silently overwrote the other's displayed status.

Fixed with an additive migration (`20260903000001-add-prescription-id-to-patient-medications.js`) adding a nullable `prescription_id` FK (`ON DELETE CASCADE`) to `patient_medications`, plus a route-side change so each prescription gets its own status row:

- `POST /` now always inserts a dedicated `patient_medications` row linked by `prescription_id`, instead of upserting on the pair.
- `PUT /:id` tries, in order: (1) update its own row via `prescription_id`, (2) claim an unclaimed legacy row for the same `(patient_id, medication_id)` where `prescription_id IS NULL` (pre-migration data, or a row still shared with a sibling prescription), (3) insert a fresh row if neither exists.
- All five `GET` joins in `prescriptions.js` prefer `pm.prescription_id = p.id`, falling back to the old pair-based match only when `prescription_id IS NULL`.

No backfill — existing installs keep their current (shared-status) rows as-is; each one becomes prescription-specific automatically the first time that prescription is next edited. Nothing breaks for rows that are never touched. Migration still needs to be run (`docker compose up -d` runs it automatically, or `npm run db:migrate`) — not yet applied against any live deployment.

## Behavior changes — checked against the frontend, confirmed safe

- `?patient_id=` query-param filter removed from `GET /` on `appointments.js`, `prescriptions.js`, `diagnostic-studies.js`, `test-results.js`. Grepped the whole frontend for `patient_id=` — zero hits. The frontend's own patient filtering (`Appointments.jsx`, `Prescriptions.jsx`, `LabReports.jsx`, `DiagnosticStudies.jsx`) uses a separate `?patient=<id>` URL param, filtered client-side after fetching the full list — it never sent `?patient_id=` to the backend at all. Nothing to restore.
- `prescriptions.js` `GET /:id` renamed the response key `medication_status` → `status`. Checked `PrescriptionDetail.jsx` — it reads `prescription.status`, the current name. Confirmed, not an issue.
- `GET /api/auth/me` / `PUT /change-password` returning 500 on a downstream DB error: re-checked the code — `authenticateToken` middleware already handles every "bad token" case (401 missing/inactive user, 403 invalid/expired) *before* either handler runs. The only way to reach their own catch blocks is a genuine DB error, where 500 is correct. There's no code path where a bad token gets mishandled as a 500. Not a bug.
- `src/database/db.js` throwing at import time if `DB_USER`/`DB_PASSWORD` are unset: confirmed both `docker-compose.yml` and `docker-compose.dev.yml` pass them through from `POSTGRES_USER`/`POSTGRES_PASSWORD` (defined in `.env.example`), so every real deployment path satisfies it. Deliberate hardening against silently falling back to hardcoded DB credentials — correct as-is, nothing to change.

## Duplication / reuse cleanup — fixed

- **File-unlink path-traversal guard** — extracted to `src/utils/uploads.js`'s `safeUnlinkUpload(filePath)`, replacing all 5 copy-pasted call sites in `test-results.js` and `diagnostic-studies.js` with one implementation (base path is always computed the same way now, closing the `process.cwd()`-vs-`__dirname` inconsistency mentioned here previously).
- **Lab-value numeric validation** — extracted to `src/utils/labValues.js`'s `isValidLabValue(labValue)`, applied to all three insert sites in `test-results.js` (`POST /`, `POST /:id/lab-values`, and `PUT /:id`, which previously lacked the guard entirely and would let Postgres reject the whole update on one bad row).
- **"Count linked rows, block delete" guard** — extracted to `src/utils/counts.js`'s `countRows(executor, sql, params)`, applied in `institutions.js`, `conditions.js`, and `medications.js` (split into two calls, one per table, replacing the old combined multi-column query). `appointments.js` `DELETE /:id` instead got its ownership check and linked-count check merged into a single `LEFT JOIN` query (see Efficiency below), so it doesn't use `countRows` — no standalone count query left to extract there.
- **Distinct-values sort** — extracted to `src/utils/sort.js`'s `localeCompare` comparator, used as `.sort(localeCompare)` in `conditions.js`, `institutions.js`, `medications.js`.
- **JWT signing** — extracted to `src/utils/jwt.js`'s `signUserToken(user)`, used by signup, login, and `POST /refresh`; `JWT_SECRET`/`JWT_EXPIRES_IN` now live in one place instead of being redefined (with the same hardcoded fallback) in both `routes/auth.js` and `middleware/auth.js`.
- **`test-results.js`'s inconsistent export** — `generatePdfFilename` moved to `src/utils/pdfFilename.js` and imported normally; `test-results.js` now does a plain `module.exports = router` like every other route file.

## Efficiency — fixed

- `appointments.js` `DELETE /:id` — the ownership check and the linked-test-results check are now one query (`LEFT JOIN test_results ... GROUP BY a.patient_id`) instead of two separate round trips.
- `test-results.js` `GET /` no longer selects `extracted_text`/`structured_data` — dead weight on every list-row response since nothing populates them post PDF-parsing removal. `GET /:id` (detail) still returns them via `tr.*`, since `LabReportDetail.jsx` has a real (if currently always-empty) display path for `extracted_text`.

**TOCTOU race — fixed.** `prescriptions.js` `PUT /:id`'s own-row/claim-legacy/insert sequence for `patient_medications` now runs inside a transaction: a second migration (`20260903000002-add-unique-prescription-id-index.js`) adds a partial unique index on `prescription_id` (`WHERE prescription_id IS NOT NULL`, so unclaimed rows with `NULL` stay unaffected), the legacy-row claim step locks its candidate row with `SELECT ... FOR UPDATE` before claiming it, and the final insert is `INSERT ... ON CONFLICT (prescription_id) DO UPDATE ...` as a last line of defense if two concurrent requests for the same never-before-touched prescription both reach that branch.

## Structural — fixed

- `apiLimiter` is now applied once via `app.use(apiLimiter)` in `server.js`, positioned after the `/api/auth` mount (which keeps its own stricter `authLimiter` instead) and before every other route — no more threading it through each individual `app.use(...)` call.
- `addPatientFilter` in `middleware/auth.js` now returns 401 if `req.user` is unset instead of throwing a `TypeError` on `req.user.role` — closes the silent-failure gap if `server.js`'s middleware ordering ever regresses.

## Open items

None. Everything identified in this file has been fixed or verified as correct/non-issue. Full test suite (`npm test`) is green: 427/427.
