const crypto = require('crypto');

const HMAC_SECRET = process.env.ASSESSMENT_HMAC_SECRET || 'airis_assessment_integrity_secret_key_2026';

/**
 * Generate a cryptographically signed assessment session token
 * @param {Object} data - { applicationId, applicantId, jobId, assessmentType, maxDurationMinutes }
 */
function signAssessmentToken(data) {
  const issuedAt = Math.floor(Date.now() / 1000);
  const maxDurationMinutes = data.maxDurationMinutes || 60;
  // Expiration includes a 15-minute grace window for network lag
  const expiresAt = issuedAt + (maxDurationMinutes * 60) + (15 * 60);
  const nonce = crypto.randomBytes(8).toString('hex');

  const payload = {
    appId: data.applicationId,
    applicantId: data.applicantId,
    jobId: data.jobId,
    type: data.assessmentType || 'skill_test', // 'skill_test' | 'interview'
    iat: issuedAt,
    exp: expiresAt,
    nonce
  };

  const serialized = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const signature = crypto
    .createHmac('sha256', HMAC_SECRET)
    .update(serialized)
    .digest('base64url');

  return `${serialized}.${signature}`;
}

/**
 * Verify an assessment session token and enforce expiration & integrity
 * @param {string} token - Signed session token
 * @param {Object} expected - { applicationId, applicantId, assessmentType }
 */
function verifyAssessmentToken(token, expected = {}) {
  if (!token || typeof token !== 'string') {
    return { valid: false, error: 'NO_TOKEN_PROVIDED', message: 'Cryptographic assessment token is required' };
  }

  const parts = token.split('.');
  if (parts.length !== 2) {
    return { valid: false, error: 'MALFORMED_TOKEN', message: 'Malformed assessment token structure' };
  }

  const [serialized, signature] = parts;

  // Verify HMAC signature using timing safe equality
  const expectedSignature = crypto
    .createHmac('sha256', HMAC_SECRET)
    .update(serialized)
    .digest('base64url');

  const sigBuffer = Buffer.from(signature);
  const expectedBuffer = Buffer.from(expectedSignature);

  if (sigBuffer.length !== expectedBuffer.length || !crypto.timingSafeEqual(sigBuffer, expectedBuffer)) {
    return {
      valid: false,
      error: 'SIGNATURE_MISMATCH',
      message: 'Assessment token signature is invalid. Possible payload forgery or tampering detected.'
    };
  }

  // Parse payload
  let payload;
  try {
    payload = JSON.parse(Buffer.from(serialized, 'base64url').toString('utf8'));
  } catch (e) {
    return { valid: false, error: 'INVALID_PAYLOAD', message: 'Failed to decode assessment payload' };
  }

  // Check expiration
  const now = Math.floor(Date.now() / 1000);
  if (now > payload.exp) {
    return {
      valid: false,
      error: 'TOKEN_EXPIRED',
      message: 'Assessment session token has expired. Assessment window closed.',
      payload
    };
  }

  // Check bindings if expected properties are provided
  if (expected.applicationId && payload.appId !== expected.applicationId) {
    return {
      valid: false,
      error: 'APPLICATION_MISMATCH',
      message: 'Assessment token belongs to a different candidate application.',
      payload
    };
  }

  if (expected.applicantId && payload.applicantId !== expected.applicantId) {
    return {
      valid: false,
      error: 'APPLICANT_MISMATCH',
      message: 'Assessment token was issued to a different candidate account.',
      payload
    };
  }

  if (expected.assessmentType && payload.type !== expected.assessmentType) {
    return {
      valid: false,
      error: 'ASSESSMENT_TYPE_MISMATCH',
      message: `Token valid for ${payload.type}, but requested ${expected.assessmentType}.`,
      payload
    };
  }

  return { valid: true, payload };
}

module.exports = {
  signAssessmentToken,
  verifyAssessmentToken
};
