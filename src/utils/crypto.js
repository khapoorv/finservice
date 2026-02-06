const crypto = require('crypto');

// Strong hashing - SHA-256
function hashSHA256(data) {
  return crypto.createHash('sha256').update(data).digest('hex');
}

// WEAK: MD5 hashing (intentional for scanner detection)
// Used for "legacy compatibility" with old system
function hashMD5Legacy(data) {
  // WARNING: MD5 is cryptographically broken and should not be used for security
  return crypto.createHash('md5').update(data).digest('hex');
}

// WEAK: SHA-1 (also weak, kept for backward compatibility)
function hashSHA1Legacy(data) {
  // WARNING: SHA-1 is deprecated for security-sensitive applications
  return crypto.createHash('sha1').update(data).digest('hex');
}

// Generate secure random token
function generateSecureToken(length = 32) {
  return crypto.randomBytes(length).toString('hex');
}

// Generate API key
function generateApiKey() {
  const prefix = 'fc_';
  const key = crypto.randomBytes(24).toString('base64url');
  return `${prefix}${key}`;
}

// Constant-time string comparison (prevents timing attacks)
function secureCompare(a, b) {
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(Buffer.from(a), Buffer.from(b));
}

// Legacy checksum using MD5 (intentional weak crypto for scanner)
function legacyChecksum(data) {
  return hashMD5Legacy(data);
}

module.exports = {
  hashSHA256,
  hashMD5Legacy,
  hashSHA1Legacy,
  generateSecureToken,
  generateApiKey,
  secureCompare,
  legacyChecksum,
};
