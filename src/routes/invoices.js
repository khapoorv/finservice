const express = require('express');
const Invoice = require('../models/Invoice');
const Order = require('../models/Order');
const { authenticateJWT, requireRole } = require('../middleware/auth');
const { validate } = require('../middleware/validator');
const logger = require('../utils/logger');

const router = express.Router();

// List invoices
router.get('/', authenticateJWT, async (req, res) => {
  try {
    const { page = 1, limit = 20, status } = req.query;
    const filter = { customer: req.user.id };
    if (status) filter.status = status;

    const invoices = await Invoice.find(filter)
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(Number(limit));

    const total = await Invoice.countDocuments(filter);
    res.json({ invoices, total, page: Number(page), totalPages: Math.ceil(total / limit) });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch invoices' });
  }
});

// Get single invoice
router.get('/:id', authenticateJWT, async (req, res) => {
  try {
    const invoice = await Invoice.findOne({ _id: req.params.id, customer: req.user.id })
      .populate('order');
    if (!invoice) return res.status(404).json({ error: 'Invoice not found' });
    res.json(invoice);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch invoice' });
  }
});

// Create invoice from order
router.post('/', authenticateJWT, validate('createInvoice'), async (req, res) => {
  try {
    const { orderId, dueDate, notes } = req.validatedBody;

    const order = await Order.findOne({ _id: orderId, customer: req.user.id });
    if (!order) return res.status(404).json({ error: 'Order not found' });

    const invoice = await Invoice.create({
      order: order._id,
      customer: req.user.id,
      customerName: order.shippingAddress.fullName,
      customerEmail: order.customerEmail,
      customerAddress: order.shippingAddress,
      lineItems: order.items.map(item => ({
        description: item.productName,
        quantity: item.quantity,
        unitPrice: item.unitPrice,
        amount: item.totalPrice,
        taxRate: 0.08,
        taxAmount: item.totalPrice * 0.08,
      })),
      subtotal: order.subtotal,
      taxTotal: order.tax,
      total: order.total,
      dueDate,
      notes,
    });

    logger.info('Invoice created', { invoiceId: invoice._id, orderId });
    res.status(201).json(invoice);
  } catch (error) {
    logger.error('Invoice creation failed', { error: error.message });
    res.status(500).json({ error: 'Failed to create invoice' });
  }
});

// Download invoice as PDF
router.get('/:id/download', authenticateJWT, async (req, res) => {
  try {
    const invoice = await Invoice.findOne({ _id: req.params.id, customer: req.user.id })
      .populate('order');
    if (!invoice) return res.status(404).json({ error: 'Invoice not found' });

    // In production, this would generate a PDF
    res.json({
      message: 'PDF generation would happen here',
      invoice: invoice.toJSON(),
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to download invoice' });
  }
});

module.exports = router;
