const crypto = require('crypto');

/**
 * Custom RFC 6238 compliant TOTP Implementation using native Node.js crypto
 * Base32 encoding / decoding without external dependencies
 */

const BASE32_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';

function base32Encode(buffer) {
  let bits = 0;
  let value = 0;
  let output = '';

  for (let i = 0; i < buffer.length; i++) {
    value = (value << 8) | buffer[i];
    bits += 8;

    while (bits >= 5) {
      output += BASE32_ALPHABET[(value >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }

  if (bits > 0) {
    output += BASE32_ALPHABET[(value << (5 - bits)) & 31];
  }

  return output;
}

function base32Decode(input) {
  const cleanInput = input.toUpperCase().replace(/=+$/, '').replace(/\s+/g, '');
  let bits = 0;
  let value = 0;
  const bytes = [];

  for (let i = 0; i < cleanInput.length; i++) {
    const char = cleanInput[i];
    const val = BASE32_ALPHABET.indexOf(char);
    if (val === -1) continue;

    value = (value << 5) | val;
    bits += 5;

    if (bits >= 8) {
      bytes.push((value >>> (bits - 8)) & 255);
      bits -= 8;
    }
  }

  return Buffer.from(bytes);
}

/**
 * Generate a new random Base32 secret for TOTP (160-bit / 20 bytes)
 */
function generateSecret(length = 20) {
  const randomBytes = crypto.randomBytes(length);
  return base32Encode(randomBytes);
}

/**
 * Generate TOTP code for a given secret at a specific counter/time
 */
function generateTOTP(secret, counter = Math.floor(Date.now() / 1000 / 30)) {
  const key = base32Decode(secret);
  const counterBuffer = Buffer.alloc(8);
  counterBuffer.writeBigInt64BE(BigInt(counter));

  const hmac = crypto.createHmac('sha1', key);
  hmac.update(counterBuffer);
  const digest = hmac.digest();

  // Dynamic truncation
  const offset = digest[digest.length - 1] & 0x0f;
  const binary =
    ((digest[offset] & 0x7f) << 24) |
    ((digest[offset + 1] & 0xff) << 16) |
    ((digest[offset + 2] & 0xff) << 8) |
    (digest[offset + 3] & 0xff);

  const otp = (binary % 1000000).toString().padStart(6, '0');
  return otp;
}

/**
 * Verify a TOTP code with time-drift tolerance (+/- 1 time step = 30 seconds)
 */
function verifyTOTP(secret, token, window = 1) {
  if (!secret || !token) return false;
  const cleanToken = token.toString().trim().replace(/\s+/g, '');
  if (!/^\d{6}$/.test(cleanToken)) return false;

  const currentCounter = Math.floor(Date.now() / 1000 / 30);

  for (let offset = -window; offset <= window; offset++) {
    const expected = generateTOTP(secret, currentCounter + offset);
    if (crypto.timingSafeEqual(Buffer.from(cleanToken), Buffer.from(expected))) {
      return true;
    }
  }

  return false;
}

/**
 * Generate 8 cryptographically secure backup recovery codes
 */
function generateBackupCodes(count = 8) {
  const codes = [];
  for (let i = 0; i < count; i++) {
    const part1 = crypto.randomBytes(2).toString('hex').toUpperCase();
    const part2 = crypto.randomBytes(2).toString('hex').toUpperCase();
    codes.push(`${part1}-${part2}`);
  }
  return codes;
}

/**
 * Generate otpauth URL suitable for QR codes and authenticator apps
 */
function generateOtpAuthUri(email, secret, issuer = 'AIRIS Talent') {
  const encodedIssuer = encodeURIComponent(issuer);
  const encodedEmail = encodeURIComponent(email);
  return `otpauth://totp/${encodedIssuer}:${encodedEmail}?secret=${secret}&issuer=${encodedIssuer}&algorithm=SHA1&digits=6&period=30`;
}

module.exports = {
  generateSecret,
  generateTOTP,
  verifyTOTP,
  generateBackupCodes,
  generateOtpAuthUri,
  base32Encode,
  base32Decode
};
