const mongoose = require('mongoose');

const invoiceLineSchema = new mongoose.Schema({
  description: { type: String, required: true },
  quantity: { type: Number, required: true },
  unitPrice: { type: Number, required: true },
  amount: { type: Number, required: true },
  taxRate: { type: Number, default: 0 },
  taxAmount: { type: Number, default: 0 },
});

const invoiceSchema = new mongoose.Schema({
  invoiceNumber: { type: String, required: true, unique: true },
  order: { type: mongoose.Schema.Types.ObjectId, ref: 'Order', required: true },
  customer: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },

  // PII fields - billing info
  customerName: { type: String, required: true },
  customerEmail: { type: String, required: true },
  customerAddress: {
    street: String,
    city: String,
    state: String,
    zipCode: String,
    country: String,
  },
  customerTaxId: { type: String }, // Tax ID / VAT number - PII

  lineItems: [invoiceLineSchema],
  subtotal: { type: Number, required: true },
  taxTotal: { type: Number, default: 0 },
  total: { type: Number, required: true },
  currency: { type: String, default: 'USD' },

  status: {
    type: String,
    enum: ['draft', 'sent', 'paid', 'overdue', 'cancelled', 'void'],
    default: 'draft',
  },

  issueDate: { type: Date, default: Date.now },
  dueDate: { type: Date, required: true },
  paidDate: { type: Date },

  // Retention policy - invoices must be kept for 7 years for tax compliance
  retentionPolicy: {
    type: String,
    default: '7_years',
    enum: ['7_years', '10_years', 'indefinite'],
  },
  retentionExpiryDate: { type: Date },
  canBeDeleted: { type: Boolean, default: false },

  notes: { type: String },
}, {
  timestamps: true,
});

// Auto-generate invoice number
invoiceSchema.pre('save', function (next) {
  if (!this.invoiceNumber) {
    const year = new Date().getFullYear();
    this.invoiceNumber = `INV-${year}-${Date.now().toString().slice(-8)}`;
  }

  // Set retention expiry based on policy
  if (!this.retentionExpiryDate) {
    const years = this.retentionPolicy === '10_years' ? 10 : 7;
    const expiry = new Date();
    expiry.setFullYear(expiry.getFullYear() + years);
    this.retentionExpiryDate = expiry;
  }

  next();
});

// Prevent deletion if retention period hasn't expired
invoiceSchema.pre('deleteOne', function (next) {
  const invoice = this;
  if (invoice.retentionExpiryDate && new Date() < invoice.retentionExpiryDate) {
    return next(new Error('Cannot delete invoice: retention period has not expired'));
  }
  next();
});

module.exports = mongoose.model('Invoice', invoiceSchema);
