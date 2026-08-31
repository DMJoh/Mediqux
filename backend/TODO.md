# Backend cleanup TODO

Findings from a multi-angle code review of the backend diff (frontend-legacy findings excluded — that code is being retired, not maintained). Not yet actioned; revisit when doing a backend cleanup pass.

## RBAC: write-side patient-scoping is unenforced (fix first)

While building multi-patient account access, found and fixed the read-side version of this across `patients.js`, `appointments.js`, `prescriptions.js`, `test-results.js`, `diagnostic-studies.js` (every `GET` now uses the new `patientFilterClause`/`patientFilterAllows` helpers in `auth.js`). The **write side has the identical gap and is still unfixed**:

- `appointments.js` `PUT /:id` and `DELETE /:id` — no `addPatientFilter`/ownership check at all. A non-admin account scoped to specific patients can currently edit or delete *any* appointment, not just ones belonging to their linked patients.
- `test-results.js` `POST /upload`, `POST /:id/lab-values`, `POST /`, `PUT /:id`, `DELETE /:id` — all have `addPatientFilter` wired into the route (so it *looks* protected), but none of the handler bodies actually read `req.patientFilter` — same silent gap as the `GET /:id` bug that was just fixed in this same file.
- `patients.js` `PUT /:id`/`DELETE /:id` not yet checked — worth auditing at the same time given the pattern found elsewhere.

Fix: same shape as the read-side fix — for `PUT`/`DELETE`, fetch the existing row's `patient_id` first (or add it to the `RETURNING`/pre-check query) and call `patientFilterAllows(req.patientFilter, patientId)` before allowing the mutation, 403/404 otherwise. `diagnostic-studies.js` already does this correctly on `POST`/`PUT`/`DELETE` (mirror that file's pattern once at each site).

**Practical impact today: low** — the only real account in this deployment is the original admin. This becomes a real exposure the moment a second, patient-scoped (`role: 'user'`) account is created, which the multi-patient-access feature now makes easy to do.

## Bugs (fix first)

- **`src/routes/diagnostic-studies.js` (~lines 272, 330)** — `logger.warn(...)` is called in the `PUT /:id` and `DELETE /:id` catch blocks (attachment-unlink failure path), but this file never imports `logger`. If a file unlink ever actually fails (missing file, permission error), the `ReferenceError` crashes the request with a 500, masking the real cause and blocking the update/delete from completing at all. Fix: import `logger` (or swap to `console.warn`, matching what other route files do).

- **`src/middleware/auth.js:35`** — missing-token detection was changed from an explicit `if (!token) return 401` guard to a string-match on `jsonwebtoken`'s internal error message (`'jwt must be provided'`). This couples 401-vs-403 behavior to an undocumented third-party string; a `jsonwebtoken` version bump or a different failure path (e.g. `TokenExpiredError`, empty-string token) silently falls through to the generic 403 branch. Fix: restore the explicit `if (!token)` guard, or branch on `error.name`/`instanceof jwt.JsonWebTokenError` instead of `error.message`.

- **`POST /api/auth/refresh`** (`src/routes/auth.js`) — because of the same string-match bug above, calling `/refresh` with an **expired** token (the realistic trigger for wanting a refresh) returns a generic 403, not a distinguishable "expired, please refresh" signal (`jwt.verify` throws `TokenExpiredError` / `'jwt expired'`, which doesn't match the special-cased string). This undermines the endpoint's stated purpose. Check against the frontend's silent-refresh logic in `frontend/src/lib/auth.jsx` once fixed.

- **`src/routes/prescriptions.js` `PUT /:id`** (~lines 340-372) — verify intended semantics: the `patient_medications` upsert is keyed only on `(patient_id, medication_id)`, not per-prescription/appointment. If a patient has two different prescriptions for the same medication, editing either one now overwrites the single shared status row for that medication — confirm this is intentional before relying on it, since the changelog description ("stuck status") implies a narrower fix.

## Behavior changes worth double-checking

- `GET /` on `appointments.js`, `prescriptions.js`, `diagnostic-studies.js`, `test-results.js` all had their `?patient_id=` query-param filter silently removed — an admin/staff caller passing `?patient_id=X` now gets the *unfiltered* full list instead of a narrowed one, no error. No current frontend caller relies on this, but it's a quiet API contract change worth a deliberate decision (restore vs. document as removed).
- `prescriptions.js` `GET /:id` renamed the response key `medication_status` → `status`. No current consumer reads the old key, but flag for any future/external consumer.
- `GET /api/auth/me` / `PUT /change-password` now return 500 on a downstream DB error rather than the old `/me` behavior of 401 on a bad token specifically. The frontend's `api.js` treats 401/403 as "session expired" → logout; a transient 500 here won't trigger that path. Edge case, but worth a look.
- `src/database/db.js` now throws at import time if `DB_USER`/`DB_PASSWORD` are unset (previously fell back to hardcoded defaults). Correct hardening — confirmed `docker-compose.dev.yml` and the test setup already supply both — just flagging as a hard break for any ad-hoc/local invocation without `.env` populated.

## Duplication / reuse cleanup

- **File-unlink path-traversal guard** (`path.resolve('./uploads')` + `startsWith` check before `fs.unlink`) is copy-pasted across 4 call sites in `test-results.js` and `diagnostic-studies.js`, with the base path computed via `process.cwd()` in the guard but via `__dirname` in multer's storage config — a working-directory mismatch would make the guard silently skip deletion instead of failing loudly. Extract to a shared `safeUnlinkUpload(filePath)` helper.
- **Lab-value numeric validation** duplicated between `POST /` and `POST /:id/lab-values` in `test-results.js`; `PUT /:id` lacks the same guard entirely, so it accepts values the other two would reject. Extract to a shared validator, apply to all three.
- **"Count linked rows, block delete" guard** now independently reimplemented a 4th time in `appointments.js` `DELETE /:id` (matching existing one-off versions in `conditions.js`/`institutions.js`/`medications.js`). Worth a shared `checkNoDependents(table, column, id)` helper.
- **Distinct-values sort** (`.sort((a, b) => a.localeCompare(b))`) added independently in `conditions.js`, `institutions.js`, `medications.js` list-distinct-values endpoints — trivial, but a shared `sortLocale()` util would remove the triplication.
- `auth.js` `login` and `POST /refresh` each independently build the JWT payload and call `jwt.sign(...)` — extract a shared `signUserToken(user)`.
- `test-results.js` exports `module.exports = router` **and** bolts on `module.exports.generatePdfFilename = ...` — inconsistent with every other route file's plain `module.exports = router`.

## Efficiency (minor)

- `prescriptions.js` `PUT /:id` — SELECT-then-branch UPDATE/INSERT into `patient_medications` (also has a TOCTOU race under concurrent requests) could be a single `INSERT ... ON CONFLICT (patient_id, medication_id) DO UPDATE ...`.
- `appointments.js` `DELETE /:id` — new leading `SELECT COUNT(*) FROM test_results` before the delete adds a second round trip; could collapse into one conditional statement.
- `test-results.js` `GET /` still selects `extracted_text`/`structured_data` even though nothing populates them since the PDF-parsing feature was removed — two permanently-null columns on every response. Low priority, but dead weight.

## Structural (lower priority)

- `apiLimiter` is threaded through 9 separate route-registration call sites in `server.js` instead of applied once via `app.use(apiLimiter)` ahead of route mounting — any future route added to `server.js` must remember to also wire it in, with no structural guarantee it will be.
- `addPatientFilter` in `auth.js` reads `req.user.role`/`req.user.patientIds` with no guard if `req.user` is unset — relies entirely on `server.js`'s middleware ordering (`authenticateToken` before route mount). The test suite injects `req.user` directly via `tests/helpers/createApp.js` and bypasses `authenticateToken` entirely, so an ordering regression here wouldn't be caught by tests.
