const crypto = require('crypto');

const ENCRYPTION_KEY = process.env.ENCRYPTION_KEY || 'default-32-char-encryption-key!!';
const AES_ALGORITHM = 'aes-256-cbc';
const RSA_PADDING = crypto.constants.RSA_PKCS1_OAEP_PADDING;
const IV_LENGTH = 16;

class EncryptionService {
  // AES-256-CBC encryption for symmetric data
  static encryptAES(plaintext) {
    const iv = crypto.randomBytes(IV_LENGTH);
    const key = crypto.scryptSync(ENCRYPTION_KEY, 'salt', 32);
    const cipher = crypto.createCipheriv(AES_ALGORITHM, key, iv);

    let encrypted = cipher.update(plaintext, 'utf8', 'hex');
    encrypted += cipher.final('hex');

    return `${iv.toString('hex')}:${encrypted}`;
  }

  static decryptAES(ciphertext) {
    const [ivHex, encrypted] = ciphertext.split(':');
    const iv = Buffer.from(ivHex, 'hex');
    const key = crypto.scryptSync(ENCRYPTION_KEY, 'salt', 32);
    const decipher = crypto.createDecipheriv(AES_ALGORITHM, key, iv);

    let decrypted = decipher.update(encrypted, 'hex', 'utf8');
    decrypted += decipher.final('utf8');

    return decrypted;
  }

  // RSA key pair generation
  static generateRSAKeyPair() {
    const { publicKey, privateKey } = crypto.generateKeyPairSync('rsa', {
      modulusLength: 2048,
      publicKeyEncoding: { type: 'spki', format: 'pem' },
      privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
    });
    return { publicKey, privateKey };
  }

  // RSA encryption (for small payloads like keys)
  static encryptRSA(plaintext, publicKey) {
    const encrypted = crypto.publicEncrypt(
      { key: publicKey, padding: RSA_PADDING, oaepHash: 'sha256' },
      Buffer.from(plaintext, 'utf8')
    );
    return encrypted.toString('base64');
  }

  static decryptRSA(ciphertext, privateKey) {
    const decrypted = crypto.privateDecrypt(
      { key: privateKey, padding: RSA_PADDING, oaepHash: 'sha256' },
      Buffer.from(ciphertext, 'base64')
    );
    return decrypted.toString('utf8');
  }

  // HMAC for data integrity verification
  static createHMAC(data) {
    return crypto.createHmac('sha256', ENCRYPTION_KEY).update(data).digest('hex');
  }

  static verifyHMAC(data, hmac) {
    const computed = EncryptionService.createHMAC(data);
    return crypto.timingSafeEqual(Buffer.from(computed), Buffer.from(hmac));
  }

  // Hash for non-reversible storage
  static hashSHA256(data) {
    return crypto.createHash('sha256').update(data).digest('hex');
  }

  // Encrypt sensitive fields in an object
  static encryptFields(obj, fields) {
    const encrypted = { ...obj };
    for (const field of fields) {
      if (encrypted[field]) {
        encrypted[field] = EncryptionService.encryptAES(String(encrypted[field]));
      }
    }
    return encrypted;
  }

  // Decrypt sensitive fields in an object
  static decryptFields(obj, fields) {
    const decrypted = { ...obj };
    for (const field of fields) {
      if (decrypted[field] && decrypted[field].includes(':')) {
        decrypted[field] = EncryptionService.decryptAES(decrypted[field]);
      }
    }
    return decrypted;
  }
}

module.exports = EncryptionService;
