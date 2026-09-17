const jwt = require('jsonwebtoken');

// No insecure fallback here on purpose — mirrors db.js's DB_USER/DB_PASSWORD
// check. A missing JWT_SECRET used to silently fall back to a hardcoded
// string baked into this file, letting anyone who's read the source forge
// a valid admin token against any instance that forgot to set it.
if (!process.env.JWT_SECRET) {
  throw new Error('JWT_SECRET environment variable is required');
}

const JWT_SECRET = process.env.JWT_SECRET;
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '24h';

// Signs a session token for a user. Used identically by signup, login, and
// the silent-refresh endpoint — each just supplies a differently-sourced
// `{ id, username, role }` (a freshly created/looked-up user row for
// signup/login, `req.user` for refresh).
function signUserToken(user) {
  return jwt.sign(
    { userId: user.id, username: user.username, role: user.role },
    JWT_SECRET,
    { expiresIn: JWT_EXPIRES_IN }
  );
}

module.exports = { signUserToken, JWT_SECRET, JWT_EXPIRES_IN };
