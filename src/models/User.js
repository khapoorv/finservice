const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const userSchema = new mongoose.Schema({
  // PII fields
  email: { type: String, required: true, unique: true, lowercase: true },
  firstName: { type: String, required: true },
  lastName: { type: String, required: true },
  phone: { type: String },
  dateOfBirth: { type: Date },
  address: {
    street: String,
    city: String,
    state: String,
    zipCode: String,
    country: String,
  },
  socialSecurityNumber: { type: String, select: false }, // SSN - highly sensitive PII

  // Auth
  password: { type: String, required: true, select: false },
  role: { type: String, enum: ['customer', 'vendor', 'admin'], default: 'customer' },
  oauthProvider: { type: String, enum: ['google', 'github', null], default: null },
  oauthId: { type: String },

  // Account status
  isActive: { type: Boolean, default: true },
  emailVerified: { type: Boolean, default: false },
  lastLogin: { type: Date },

  // Soft delete
  isDeleted: { type: Boolean, default: false },
  deletedAt: { type: Date },

  // GDPR
  consentGiven: { type: Boolean, default: false },
  consentDate: { type: Date },
  dataRetentionExpiry: { type: Date },
}, {
  timestamps: true,
});

// Hash password before saving using bcrypt
userSchema.pre('save', async function (next) {
  if (!this.isModified('password')) return next();
  const salt = await bcrypt.genSalt(12);
  this.password = await bcrypt.hash(this.password, salt);
  next();
});

// Compare password method
userSchema.methods.comparePassword = async function (candidatePassword) {
  return bcrypt.compare(candidatePassword, this.password);
};

// Soft delete method
userSchema.methods.softDelete = function () {
  this.isDeleted = true;
  this.deletedAt = new Date();
  this.isActive = false;
  return this.save();
};

// Exclude soft-deleted documents by default
userSchema.pre(/^find/, function (next) {
  if (!this.getQuery().includeDeleted) {
    this.where({ isDeleted: false });
  }
  next();
});

// Remove sensitive fields from JSON output
userSchema.methods.toJSON = function () {
  const obj = this.toObject();
  delete obj.password;
  delete obj.socialSecurityNumber;
  return obj;
};

module.exports = mongoose.model('User', userSchema);
