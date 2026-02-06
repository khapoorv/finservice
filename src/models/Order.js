const mongoose = require('mongoose');

const orderItemSchema = new mongoose.Schema({
  product: { type: mongoose.Schema.Types.ObjectId, ref: 'Product', required: true },
  productName: { type: String, required: true },
  quantity: { type: Number, required: true, min: 1 },
  unitPrice: { type: Number, required: true },
  totalPrice: { type: Number, required: true },
});

const orderSchema = new mongoose.Schema({
  orderNumber: { type: String, required: true, unique: true },
  customer: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },

  // PII fields - shipping info
  customerEmail: { type: String, required: true },
  customerPhone: { type: String },
  shippingAddress: {
    fullName: { type: String, required: true },
    street: { type: String, required: true },
    city: { type: String, required: true },
    state: { type: String, required: true },
    zipCode: { type: String, required: true },
    country: { type: String, required: true },
  },
  billingAddress: {
    fullName: String,
    street: String,
    city: String,
    state: String,
    zipCode: String,
    country: String,
  },

  items: [orderItemSchema],
  subtotal: { type: Number, required: true },
  tax: { type: Number, required: true, default: 0 },
  shippingCost: { type: Number, default: 0 },
  total: { type: Number, required: true },

  status: {
    type: String,
    enum: ['pending', 'confirmed', 'processing', 'shipped', 'delivered', 'cancelled', 'refunded'],
    default: 'pending',
  },

  paymentStatus: {
    type: String,
    enum: ['pending', 'paid', 'failed', 'refunded'],
    default: 'pending',
  },

  // Soft delete
  isDeleted: { type: Boolean, default: false },
  deletedAt: { type: Date },

  notes: { type: String },
}, {
  timestamps: true,
});

// Generate order number
orderSchema.pre('save', function (next) {
  if (!this.orderNumber) {
    this.orderNumber = `FC-${Date.now()}-${Math.random().toString(36).substr(2, 6).toUpperCase()}`;
  }
  next();
});

// Soft delete
orderSchema.methods.softDelete = function () {
  this.isDeleted = true;
  this.deletedAt = new Date();
  return this.save();
};

orderSchema.pre(/^find/, function (next) {
  if (!this.getQuery().includeDeleted) {
    this.where({ isDeleted: false });
  }
  next();
});

module.exports = mongoose.model('Order', orderSchema);
