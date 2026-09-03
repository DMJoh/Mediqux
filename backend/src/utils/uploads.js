const path = require('node:path');
const fs = require('node:fs').promises;
const logger = require('./logger');

// Best-effort delete of a file that must live under the uploads directory.
// Resolves both paths and requires the target to sit inside uploadsDir before
// unlinking, so a stray/malicious path (e.g. containing '..') is silently
// skipped rather than deleting something outside uploads. Errors (missing
// file, permissions) are logged and swallowed — every caller treats file
// cleanup as best-effort, never something that should fail the request.
async function safeUnlinkUpload(filePath) {
  if (!filePath) return;
  try {
    const uploadsDir = path.resolve('./uploads');
    const resolved = path.resolve(filePath);
    if (resolved.startsWith(uploadsDir + path.sep)) {
      await fs.unlink(resolved);
    }
  } catch (error) {
    logger.warn('Failed to delete uploaded file', { error: error.message, path: filePath });
  }
}

module.exports = { safeUnlinkUpload };
