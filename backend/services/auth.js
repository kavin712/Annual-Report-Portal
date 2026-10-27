const crypto = require('node:crypto');
const config = require('../config');

/**
 * Hash a plain password using scrypt with random salt
 * @param {string} password
 * @returns {string} format 'salt:derivedKey'
 */
function hashPassword(password) {
  if (!password || typeof password !== 'string') {
    throw new Error('Password must be a non-empty string');
  }
  const salt = crypto.randomBytes(16).toString('hex');
  const derivedKey = crypto.scryptSync(password, salt, 64).toString('hex');
  return `${salt}:${derivedKey}`;
}

/**
 * Verify a plain password against stored hash or legacy plain text
 * @param {string} candidatePassword
 * @param {string} storedPasswordHash
 * @returns {boolean}
 */
function verifyPassword(candidatePassword, storedPasswordHash) {
  if (!candidatePassword || !storedPasswordHash) return false;

  // If stored in salt:hash format
  if (storedPasswordHash.includes(':')) {
    try {
      const [salt, key] = storedPasswordHash.split(':');
      const keyBuffer = Buffer.from(key, 'hex');
      const derivedKey = crypto.scryptSync(candidatePassword, salt, 64);
      return crypto.timingSafeEqual(keyBuffer, derivedKey);
    } catch (e) {
      return false;
    }
  }

  // Fallback for legacy plain text before migration
  return candidatePassword === storedPasswordHash;
}

/**
 * Generate a cryptographically signed HMAC-SHA256 session token
 * @param {Object} user
 * @returns {string}
 */
function generateToken(user) {
  const payload = {
    id: user.id,
    email: user.email,
    name: user.name,
    role: user.role,
    department: user.department,
    iat: Date.now(),
    exp: Date.now() + 7 * 24 * 60 * 60 * 1000 // 7 days validity
  };

  const encodedPayload = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const signature = crypto
    .createHmac('sha256', config.SESSION_SECRET)
    .update(encodedPayload)
    .digest('base64url');

  return `${encodedPayload}.${signature}`;
}

/**
 * Verify a cryptographically signed token and return the payload if valid
 * @param {string} token
 * @returns {Object|null}
 */
function verifyToken(token) {
  if (!token || typeof token !== 'string') return null;

  const parts = token.split('.');
  if (parts.length !== 2) return null;

  const [encodedPayload, receivedSignature] = parts;

  try {
    const expectedSignature = crypto
      .createHmac('sha256', config.SESSION_SECRET)
      .update(encodedPayload)
      .digest('base64url');

    const expectedBuf = Buffer.from(expectedSignature);
    const receivedBuf = Buffer.from(receivedSignature);

    if (expectedBuf.length !== receivedBuf.length) return null;
    if (!crypto.timingSafeEqual(expectedBuf, receivedBuf)) return null;

    const payload = JSON.parse(Buffer.from(encodedPayload, 'base64url').toString('utf8'));

    // Check expiration
    if (payload.exp && Date.now() > payload.exp) {
      return null;
    }

    return payload;
  } catch (err) {
    return null;
  }
}

module.exports = {
  hashPassword,
  verifyPassword,
  generateToken,
  verifyToken
};
