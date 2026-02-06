const mongoose = require('mongoose');

const productSchema = new mongoose.Schema({
  name: { type: String, required: true, index: true },
  description: { type: String },
  price: { type: Number, required: true, min: 0 },
  compareAtPrice: { type: Number, min: 0 },
  sku: { type: String, required: true, unique: true },
  category: { type: String, required: true, index: true },
  tags: [{ type: String }],
  images: [{ url: String, alt: String }],
  stock: { type: Number, required: true, min: 0, default: 0 },
  isActive: { type: Boolean, default: true },
  vendor: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  metadata: { type: Map, of: String },
}, {
  timestamps: true,
});

// Factory pattern - create products by type
class ProductFactory {
  static create(type, data) {
    switch (type) {
      case 'physical':
        return new Product({
          ...data,
          metadata: new Map([
            ['type', 'physical'],
            ['weight', data.weight || '0'],
            ['dimensions', data.dimensions || ''],
            ['requiresShipping', 'true'],
          ]),
        });

      case 'digital':
        return new Product({
          ...data,
          stock: 999999,
          metadata: new Map([
            ['type', 'digital'],
            ['downloadUrl', data.downloadUrl || ''],
            ['requiresShipping', 'false'],
          ]),
        });

      case 'subscription':
        return new Product({
          ...data,
          metadata: new Map([
            ['type', 'subscription'],
            ['interval', data.interval || 'monthly'],
            ['trialDays', String(data.trialDays || 0)],
            ['requiresShipping', 'false'],
          ]),
        });

      default:
        return new Product(data);
    }
  }
}

productSchema.index({ name: 'text', description: 'text' });

const Product = mongoose.model('Product', productSchema);

module.exports = { Product, ProductFactory };
