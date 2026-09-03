const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-this';
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
