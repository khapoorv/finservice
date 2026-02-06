const mongoose = require('mongoose');
const crypto = require('crypto');

const ENCRYPTION_KEY = process.env.ENCRYPTION_KEY || 'default-key-for-dev-only-32chars!';
const IV_LENGTH = 16;

// Encrypt sensitive payment data
function encrypt(text) {
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv('aes-256-cbc', Buffer.from(ENCRYPTION_KEY, 'utf-8').slice(0, 32), iv);
  let encrypted = cipher.update(text, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  return iv.toString('hex') + ':' + encrypted;
}

function decrypt(text) {
  const parts = text.split(':');
  const iv = Buffer.from(parts.shift(), 'hex');
  const encryptedText = parts.join(':');
  const decipher = crypto.createDecipheriv('aes-256-cbc', Buffer.from(ENCRYPTION_KEY, 'utf-8').slice(0, 32), iv);
  let decrypted = decipher.update(encryptedText, 'hex', 'utf8');
  decrypted += decipher.final('utf8');
  return decrypted;
}

const transactionSchema = new mongoose.Schema({
  transactionId: { type: String, required: true, unique: true },
  order: { type: mongoose.Schema.Types.ObjectId, ref: 'Order', required: true },
  customer: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },

  amount: { type: Number, required: true },
  currency: { type: String, default: 'USD' },
  type: { type: String, enum: ['charge', 'refund', 'payout'], required: true },
  status: { type: String, enum: ['pending', 'completed', 'failed', 'reversed'], default: 'pending' },

  // Encrypted payment details
  paymentGateway: { type: String, enum: ['stripe', 'paypal'], required: true },
  gatewayTransactionId: { type: String },
  encryptedCardLast4: { type: String }, // Encrypted for compliance

  // Audit trail
  initiatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  ipAddress: { type: String },
  metadata: { type: Map, of: String },

  // Timestamps for audit logging
  processedAt: { type: Date },
  failedAt: { type: Date },
  failureReason: { type: String },
}, {
  timestamps: true,
});

// Encrypt card info before saving
transactionSchema.pre('save', function (next) {
  if (this.isModified('encryptedCardLast4') && this.encryptedCardLast4) {
    if (!this.encryptedCardLast4.includes(':')) {
      this.encryptedCardLast4 = encrypt(this.encryptedCardLast4);
    }
  }
  next();
});

// Method to get decrypted card last 4
transactionSchema.methods.getCardLast4 = function () {
  if (!this.encryptedCardLast4) return null;
  return decrypt(this.encryptedCardLast4);
};

// Audit log on status change
transactionSchema.post('save', function (doc) {
  if (doc.isModified && doc.isModified('status')) {
    console.log(`[AUDIT] Transaction ${doc.transactionId} status changed to ${doc.status}`);
  }
});

module.exports = mongoose.model('Transaction', transactionSchema);
