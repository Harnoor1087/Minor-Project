/**
 * Recursive input sanitization against XSS and script injection attacks
 */

function sanitizeString(str) {
  if (typeof str !== 'string') return str;
  return str
    // Strip <script>...</script> tags entirely
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
    // Strip javascript: pseudo-protocol
    .replace(/javascript:/gi, '')
    // Strip inline event handlers like onerror=, onload=, onclick=
    .replace(/\bon\w+\s*=/gi, '')
    // Escape standard dangerous characters for HTML injection
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function sanitizeObject(obj) {
  if (!obj || typeof obj !== 'object') return obj;

  if (Array.isArray(obj)) {
    return obj.map(item => {
      if (typeof item === 'string') return sanitizeString(item);
      if (typeof item === 'object') return sanitizeObject(item);
      return item;
    });
  }

  const sanitized = {};
  for (const [key, value] of Object.entries(obj)) {
    // Preserve password fields without HTML entity replacement to not break password hashes
    if (key.toLowerCase().includes('password')) {
      sanitized[key] = value;
    } else if (typeof value === 'string') {
      sanitized[key] = sanitizeString(value);
    } else if (typeof value === 'object' && value !== null) {
      sanitized[key] = sanitizeObject(value);
    } else {
      sanitized[key] = value;
    }
  }
  return sanitized;
}

function sanitizeInputMiddleware(req, res, next) {
  if (req.body && typeof req.body === 'object') {
    req.body = sanitizeObject(req.body);
  }
  if (req.query && typeof req.query === 'object') {
    req.query = sanitizeObject(req.query);
  }
  next();
}

module.exports = {
  sanitizeString,
  sanitizeObject,
  sanitizeInputMiddleware
};
