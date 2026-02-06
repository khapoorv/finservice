const EventBus = require('../EventBus');
const NotificationService = require('../../services/NotificationService');
const AnalyticsService = require('../../services/AnalyticsService');
const { emailQueue } = require('../../services/QueueService');
const AuditLog = require('../../models/AuditLog');
const logger = require('../../utils/logger');

const eventBus = EventBus.getInstance();
const analytics = new AnalyticsService();

// Subscribe to payment:completed event
eventBus.subscribe('payment:completed', async ({ transaction, orderId, userId }) => {
  logger.info('Handling payment:completed event', {
    transactionId: transaction.transactionId,
    amount: transaction.amount,
  });

  // Queue payment receipt email
  await emailQueue.add('payment_receipt', {
    type: 'payment_receipt',
    data: { transaction, user: { id: userId } },
  });

  // Track payment analytics
  analytics.trackEvent('payment_completed', {
    transactionId: transaction.transactionId,
    amount: transaction.amount,
    gateway: transaction.paymentGateway,
  }, userId);

  // Create audit entry for payment
  try {
    await AuditLog.create({
      requestId: transaction.transactionId,
      timestamp: new Date(),
      method: 'PAYMENT',
      path: `/payments/${orderId}`,
      statusCode: 200,
      userId,
      action: 'payment',
      resource: 'transaction',
      resourceId: transaction.transactionId,
    });
  } catch (error) {
    logger.error('Failed to create payment audit log', { error: error.message });
  }
});

// Subscribe to payment:failed event
eventBus.subscribe('payment:failed', async ({ orderId, error, userId }) => {
  logger.warn('Handling payment:failed event', { orderId, error });

  analytics.trackEvent('payment_failed', {
    orderId,
    error,
  }, userId);
});

// Subscribe to payment:refunded event
eventBus.subscribe('payment:refunded', async ({ transactionId, userId }) => {
  logger.info('Handling payment:refunded event', { transactionId });

  analytics.trackEvent('payment_refunded', {
    transactionId,
  }, userId);

  // Audit log for refund
  try {
    await AuditLog.create({
      requestId: `refund-${transactionId}`,
      timestamp: new Date(),
      method: 'REFUND',
      path: `/payments/refund/${transactionId}`,
      statusCode: 200,
      userId,
      action: 'refund',
      resource: 'transaction',
      resourceId: transactionId,
    });
  } catch (error) {
    logger.error('Failed to create refund audit log', { error: error.message });
  }
});

module.exports = {};
