const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
const paypal = require('paypal-rest-sdk');
const Order = require('../models/Order');
const Transaction = require('../models/Transaction');
const { v4: uuidv4 } = require('uuid');
const logger = require('../utils/logger');

// Configure PayPal
paypal.configure({
  mode: process.env.NODE_ENV === 'production' ? 'live' : 'sandbox',
  client_id: process.env.PAYPAL_CLIENT_ID,
  client_secret: process.env.PAYPAL_CLIENT_SECRET,
});

class PaymentService {
  async processPayment({ orderId, paymentMethod, token, userId, ipAddress }) {
    const order = await Order.findById(orderId);
    if (!order) throw new Error('Order not found');
    if (order.paymentStatus === 'paid') throw new Error('Order already paid');

    let gatewayResult;

    switch (paymentMethod) {
      case 'stripe':
        gatewayResult = await this.chargeStripe(order, token);
        break;
      case 'paypal':
        gatewayResult = await this.chargePayPal(order, token);
        break;
      default:
        throw new Error(`Unsupported payment method: ${paymentMethod}`);
    }

    // Create transaction record
    const transaction = await Transaction.create({
      transactionId: uuidv4(),
      order: order._id,
      customer: userId,
      amount: order.total,
      currency: 'USD',
      type: 'charge',
      status: 'completed',
      paymentGateway: paymentMethod,
      gatewayTransactionId: gatewayResult.id,
      encryptedCardLast4: gatewayResult.cardLast4 || null,
      initiatedBy: userId,
      ipAddress,
      processedAt: new Date(),
    });

    // Update order payment status
    order.paymentStatus = 'paid';
    order.status = 'confirmed';
    await order.save();

    return { transaction, gatewayResult };
  }

  async chargeStripe(order, token) {
    const charge = await stripe.paymentIntents.create({
      amount: Math.round(order.total * 100), // Stripe uses cents
      currency: 'usd',
      payment_method: token,
      confirm: true,
      metadata: {
        orderId: order._id.toString(),
        orderNumber: order.orderNumber,
      },
    });

    return {
      id: charge.id,
      status: charge.status,
      cardLast4: charge.payment_method_details?.card?.last4,
    };
  }

  async chargePayPal(order, token) {
    return new Promise((resolve, reject) => {
      const paymentData = {
        intent: 'sale',
        payer: { payment_method: 'paypal' },
        transactions: [{
          amount: { total: order.total.toFixed(2), currency: 'USD' },
          description: `FinCommerce Order ${order.orderNumber}`,
        }],
      };

      paypal.payment.execute(token, { payer_id: token }, (error, payment) => {
        if (error) return reject(new Error('PayPal payment failed'));
        resolve({ id: payment.id, status: payment.state });
      });
    });
  }

  async refundPayment(transactionId, reason) {
    const transaction = await Transaction.findOne({ transactionId });
    if (!transaction) throw new Error('Transaction not found');
    if (transaction.status !== 'completed') throw new Error('Transaction cannot be refunded');

    if (transaction.paymentGateway === 'stripe') {
      await stripe.refunds.create({
        payment_intent: transaction.gatewayTransactionId,
        reason: 'requested_by_customer',
      });
    }

    const refundTransaction = await Transaction.create({
      transactionId: uuidv4(),
      order: transaction.order,
      customer: transaction.customer,
      amount: -transaction.amount,
      currency: transaction.currency,
      type: 'refund',
      status: 'completed',
      paymentGateway: transaction.paymentGateway,
      gatewayTransactionId: transaction.gatewayTransactionId,
      processedAt: new Date(),
      metadata: new Map([['reason', reason || 'customer_request']]),
    });

    // Update original transaction
    transaction.status = 'reversed';
    await transaction.save();

    // Update order
    await Order.findByIdAndUpdate(transaction.order, {
      paymentStatus: 'refunded',
      status: 'refunded',
    });

    return refundTransaction;
  }

  async handleStripeWebhook(body, signature) {
    const event = stripe.webhooks.constructEvent(
      body,
      signature,
      process.env.STRIPE_WEBHOOK_SECRET
    );

    switch (event.type) {
      case 'payment_intent.succeeded':
        logger.info('Stripe payment succeeded', { id: event.data.object.id });
        break;
      case 'payment_intent.payment_failed':
        logger.warn('Stripe payment failed', { id: event.data.object.id });
        break;
    }
  }

  async getTransactionHistory(userId, { page = 1, limit = 20 }) {
    const transactions = await Transaction.find({ customer: userId })
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(Number(limit));
    const total = await Transaction.countDocuments({ customer: userId });
    return { transactions, total, page: Number(page) };
  }
}

module.exports = PaymentService;
