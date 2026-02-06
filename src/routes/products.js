const express = require('express');
const { Product, ProductFactory } = require('../models/Product');
const { authenticateJWT, requireRole } = require('../middleware/auth');
const { validate } = require('../middleware/validator');
const CacheService = require('../services/CacheService');

const router = express.Router();

// List products with search and filtering - uses parameterized queries
router.get('/', async (req, res) => {
  try {
    const { page = 1, limit = 20, category, search, minPrice, maxPrice, sort } = req.query;

    // Parameterized query - safe from SQL/NoSQL injection
    const filter = { isActive: true };

    if (category) {
      filter.category = { $eq: category }; // Parameterized equality check
    }
    if (search) {
      filter.$text = { $search: search }; // MongoDB text search (parameterized)
    }
    if (minPrice || maxPrice) {
      filter.price = {};
      if (minPrice) filter.price.$gte = Number(minPrice);
      if (maxPrice) filter.price.$lte = Number(maxPrice);
    }

    // Check cache first
    const cacheKey = `products:${JSON.stringify({ filter, page, limit, sort })}`;
    const cached = await CacheService.getInstance().get(cacheKey);
    if (cached) {
      return res.json(cached);
    }

    const sortOptions = {};
    if (sort === 'price_asc') sortOptions.price = 1;
    else if (sort === 'price_desc') sortOptions.price = -1;
    else sortOptions.createdAt = -1;

    const products = await Product.find(filter)
      .sort(sortOptions)
      .skip((page - 1) * limit)
      .limit(Number(limit))
      .lean();

    const total = await Product.countDocuments(filter);
    const result = { products, total, page: Number(page), totalPages: Math.ceil(total / limit) };

    // Cache for 5 minutes
    await CacheService.getInstance().set(cacheKey, result, 300);

    res.json(result);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch products' });
  }
});

// Get single product
router.get('/:id', async (req, res) => {
  try {
    const product = await Product.findById(req.params.id);
    if (!product) return res.status(404).json({ error: 'Product not found' });
    res.json(product);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch product' });
  }
});

// Create product (vendor/admin only)
router.post('/', authenticateJWT, requireRole('vendor', 'admin'), validate('createProduct'), async (req, res) => {
  try {
    const productType = req.body.type || 'physical';
    const product = ProductFactory.create(productType, {
      ...req.validatedBody,
      vendor: req.user.id,
    });
    await product.save();

    // Invalidate product list cache
    await CacheService.getInstance().invalidatePattern('products:*');

    res.status(201).json(product);
  } catch (error) {
    res.status(500).json({ error: 'Failed to create product' });
  }
});

// Update product
router.put('/:id', authenticateJWT, requireRole('vendor', 'admin'), async (req, res) => {
  try {
    const product = await Product.findOneAndUpdate(
      { _id: req.params.id, vendor: req.user.id },
      { $set: req.body },
      { new: true, runValidators: true }
    );
    if (!product) return res.status(404).json({ error: 'Product not found' });

    await CacheService.getInstance().invalidatePattern('products:*');
    res.json(product);
  } catch (error) {
    res.status(500).json({ error: 'Failed to update product' });
  }
});

// Delete product
router.delete('/:id', authenticateJWT, requireRole('vendor', 'admin'), async (req, res) => {
  try {
    const product = await Product.findOneAndUpdate(
      { _id: req.params.id, vendor: req.user.id },
      { isActive: false },
      { new: true }
    );
    if (!product) return res.status(404).json({ error: 'Product not found' });
    res.json({ message: 'Product deactivated' });
  } catch (error) {
    res.status(500).json({ error: 'Failed to delete product' });
  }
});

module.exports = router;
