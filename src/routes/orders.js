const express = require('express');
const Order = require('../models/Order');
const { Product } = require('../models/Product');
const { authenticateJWT } = require('../middleware/auth');
const { validate } = require('../middleware/validator');
const EventBus = require('../events/EventBus');
const logger = require('../utils/logger');

const router = express.Router();

// List user's orders
router.get('/', authenticateJWT, async (req, res) => {
  try {
    const { page = 1, limit = 20, status } = req.query;
    const filter = { customer: req.user.id };
    if (status) filter.status = status;

    const orders = await Order.find(filter)
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(Number(limit))
      .populate('items.product', 'name images');

    const total = await Order.countDocuments(filter);
    res.json({ orders, total, page: Number(page), totalPages: Math.ceil(total / limit) });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch orders' });
  }
});

// Get single order
router.get('/:id', authenticateJWT, async (req, res) => {
  try {
    const order = await Order.findOne({ _id: req.params.id, customer: req.user.id })
      .populate('items.product');
    if (!order) return res.status(404).json({ error: 'Order not found' });
    res.json(order);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch order' });
  }
});

// Create order
router.post('/', authenticateJWT, validate('createOrder'), async (req, res) => {
  try {
    const { items, shippingAddress } = req.validatedBody;
    const user = req.user;

    // Resolve products and calculate totals
    let subtotal = 0;
    const orderItems = [];

    for (const item of items) {
      const product = await Product.findById(item.productId);
      if (!product) {
        return res.status(400).json({ error: `Product ${item.productId} not found` });
      }
      if (product.stock < item.quantity) {
        return res.status(400).json({ error: `Insufficient stock for ${product.name}` });
      }

      const totalPrice = product.price * item.quantity;
      subtotal += totalPrice;

      orderItems.push({
        product: product._id,
        productName: product.name,
        quantity: item.quantity,
        unitPrice: product.price,
        totalPrice,
      });

      // Reduce stock
      product.stock -= item.quantity;
      await product.save();
    }

    const tax = subtotal * 0.08; // 8% tax
    const shippingCost = subtotal > 100 ? 0 : 9.99;
    const total = subtotal + tax + shippingCost;

    const order = await Order.create({
      customer: user.id,
      customerEmail: user.email,
      shippingAddress: { fullName: `${user.firstName} ${user.lastName}`, ...shippingAddress },
      items: orderItems,
      subtotal,
      tax,
      shippingCost,
      total,
    });

    // Emit order created event
    EventBus.getInstance().emit('order:created', { order, user });

    logger.info('Order created', { orderId: order._id, total });
    res.status(201).json(order);
  } catch (error) {
    logger.error('Order creation failed', { error: error.message });
    res.status(500).json({ error: 'Failed to create order' });
  }
});

// Cancel order
router.post('/:id/cancel', authenticateJWT, async (req, res) => {
  try {
    const order = await Order.findOne({ _id: req.params.id, customer: req.user.id });
    if (!order) return res.status(404).json({ error: 'Order not found' });
    if (!['pending', 'confirmed'].includes(order.status)) {
      return res.status(400).json({ error: 'Order cannot be cancelled in current state' });
    }

    order.status = 'cancelled';
    await order.save();

    EventBus.getInstance().emit('order:cancelled', { order });
    res.json({ message: 'Order cancelled', order });
  } catch (error) {
    res.status(500).json({ error: 'Failed to cancel order' });
  }
});

module.exports = router;
