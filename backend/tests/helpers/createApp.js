const express = require('express');

/**
 * Creates a minimal Express test app that mounts a router with an injected
 * user context, bypassing real JWT auth. This lets us test route logic in
 * isolation without a running database or valid tokens.
 *
 * @param {import('express').Router} router - The route module to mount
 * @param {object} userOverrides - Partial user object to merge with defaults
 * @returns {import('express').Application}
 */
function createApp(router, userOverrides = {}) {
  const app = express();
  app.use(express.json());

  // Accept either a single `patientId` (legacy single-patient shape, still
  // used by most test files) or a `patientIds` array (the real multi-patient
  // shape `req.user`/`req.patientFilter` carry in production).
  const { patientId, patientIds, ...rest } = userOverrides;
  const resolvedPatientIds = patientIds ?? (patientId != null ? [patientId] : []);

  const defaultUser = {
    id: 1,
    username: 'testadmin',
    role: 'admin',
    ...rest,
    patientIds: resolvedPatientIds,
  };

  // Inject auth state directly — no real JWT needed in unit tests
  app.use((req, res, next) => {
    req.user = defaultUser;
    req.patientFilter = defaultUser.role === 'admin'
      ? null
      : (defaultUser.patientIds.length > 0 ? defaultUser.patientIds : 'none');
    next();
  });

  app.use('/', router);
  return app;
}

module.exports = createApp;
