const express = require('express');
const { authenticateJWT } = require('../middleware/auth');
const { validate } = require('../middleware/validator');
const { paymentLimiter } = require('../middleware/rateLimiter');
const PaymentService = require('../services/PaymentService');
const EventBus = require('../events/EventBus');
const logger = require('../utils/logger');

const router = express.Router();

// Process payment
router.post('/charge', authenticateJWT, paymentLimiter, validate('processPayment'), async (req, res) => {
  try {
    const { orderId, paymentMethod, token } = req.validatedBody;
    const paymentService = new PaymentService();

    const result = await paymentService.processPayment({
      orderId,
      paymentMethod,
      token,
      userId: req.user.id,
      ipAddress: req.ip,
    });

    EventBus.getInstance().emit('payment:completed', {
      transaction: result.transaction,
      orderId,
      userId: req.user.id,
    });

    logger.info('Payment processed', {
      orderId,
      transactionId: result.transaction.transactionId,
      amount: result.transaction.amount,
    });

    res.json({ success: true, transaction: result.transaction });
  } catch (error) {
    EventBus.getInstance().emit('payment:failed', {
      orderId: req.body.orderId,
      error: error.message,
    });

    logger.error('Payment failed', { error: error.message, orderId: req.body.orderId });
    res.status(400).json({ error: error.message });
  }
});

// Refund payment
router.post('/refund/:transactionId', authenticateJWT, async (req, res) => {
  try {
    const paymentService = new PaymentService();
    const result = await paymentService.refundPayment(req.params.transactionId, req.body.reason);

    EventBus.getInstance().emit('payment:refunded', {
      transactionId: req.params.transactionId,
      userId: req.user.id,
    });

    res.json({ success: true, refund: result });
  } catch (error) {
    logger.error('Refund failed', { error: error.message });
    res.status(400).json({ error: error.message });
  }
});

// Stripe webhook
router.post('/webhook/stripe', express.raw({ type: 'application/json' }), async (req, res) => {
  const sig = req.headers['stripe-signature'];
  try {
    const paymentService = new PaymentService();
    await paymentService.handleStripeWebhook(req.body, sig);
    res.json({ received: true });
  } catch (error) {
    logger.error('Stripe webhook failed', { error: error.message });
    res.status(400).json({ error: error.message });
  }
});

// Get payment history
router.get('/history', authenticateJWT, async (req, res) => {
  try {
    const paymentService = new PaymentService();
    const transactions = await paymentService.getTransactionHistory(req.user.id, req.query);
    res.json(transactions);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch payment history' });
  }
});

module.exports = router;
