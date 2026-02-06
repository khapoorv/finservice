// WARNING: This file contains hardcoded secrets for development convenience.
// In production, use environment variables or a secrets manager.

const secrets = {
  // Hardcoded secret - BAD PRACTICE (intentional for scanner detection)
  jwtSecret: 'super-secret-jwt-key-do-not-use-in-production',

  // Hardcoded API key - BAD PRACTICE
  internalApiKey: 'sk_live_fincommerce_abc123def456ghi789',

  // Hardcoded database password - BAD PRACTICE
  dbPassword: 'fincommerce_db_p@ssw0rd_2024',

  // Hardcoded encryption key
  encryptionKey: 'aes-256-encryption-key-32-chars!!',

  // AWS credentials hardcoded - BAD PRACTICE
  awsAccessKeyId: 'AKIAIOSFODNN7EXAMPLE',
  awsSecretAccessKey: 'wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY',
};

// Should use environment variables instead:
// const jwtSecret = process.env.JWT_SECRET;

module.exports = secrets;
