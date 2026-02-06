const EventBus = require('../EventBus');
const NotificationService = require('../../services/NotificationService');
const AnalyticsService = require('../../services/AnalyticsService');
const { emailQueue } = require('../../services/QueueService');
const logger = require('../../utils/logger');

const eventBus = EventBus.getInstance();
const analytics = new AnalyticsService();

// Subscribe to order:created event
eventBus.subscribe('order:created', async ({ order, user }) => {
  logger.info('Handling order:created event', { orderId: order._id });

  // Queue email notification
  await emailQueue.add('order_confirmation', {
    type: 'order_confirmation',
    data: { order, user },
  });

  // Track in analytics
  analytics.trackPurchase(order, user.id);
});

// Subscribe to order:cancelled event
eventBus.subscribe('order:cancelled', async ({ order }) => {
  logger.info('Handling order:cancelled event', { orderId: order._id });

  // Notify customer
  await emailQueue.add('order_cancelled', {
    type: 'generic',
    data: {
      to: order.customerEmail,
      subject: `Order Cancelled - ${order.orderNumber}`,
      html: `<p>Your order ${order.orderNumber} has been cancelled.</p>`,
    },
  });

  analytics.trackEvent('order_cancelled', {
    orderId: order.orderNumber,
    total: order.total,
  });
});

// Subscribe to order:shipped event
eventBus.subscribe('order:shipped', async ({ order, trackingNumber }) => {
  logger.info('Handling order:shipped event', { orderId: order._id, trackingNumber });

  await emailQueue.add('shipping_notification', {
    type: 'shipping',
    data: { order, trackingNumber },
  });

  analytics.trackEvent('order_shipped', {
    orderId: order.orderNumber,
  });
});

// Subscribe to order:delivered event
eventBus.subscribe('order:delivered', async ({ order }) => {
  logger.info('Handling order:delivered event', { orderId: order._id });

  analytics.trackEvent('order_delivered', {
    orderId: order.orderNumber,
    deliveryTime: Date.now() - new Date(order.createdAt).getTime(),
  });
});

module.exports = {}; // Event handlers auto-register on import
