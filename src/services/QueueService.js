const Queue = require('bull');
const logger = require('../utils/logger');

const REDIS_URL = process.env.REDIS_URL || 'redis://localhost:6379';

// Message queues for async processing
const emailQueue = new Queue('email', REDIS_URL, {
  defaultJobOptions: {
    removeOnComplete: 100,
    removeOnFail: 50,
    attempts: 3,
    backoff: { type: 'exponential', delay: 2000 },
  },
});

const paymentQueue = new Queue('payment', REDIS_URL, {
  defaultJobOptions: {
    removeOnComplete: 50,
    attempts: 5,
    backoff: { type: 'exponential', delay: 5000 },
  },
});

const reportQueue = new Queue('report', REDIS_URL, {
  defaultJobOptions: {
    removeOnComplete: 20,
    attempts: 2,
    timeout: 300000, // 5 minutes for report generation
  },
});

const webhookQueue = new Queue('webhook', REDIS_URL, {
  defaultJobOptions: {
    removeOnComplete: 200,
    attempts: 3,
    backoff: { type: 'fixed', delay: 10000 },
  },
});

// Email queue processor
emailQueue.process(async (job) => {
  const { type, data } = job.data;
  const NotificationService = require('./NotificationService');
  const notifier = NotificationService.getInstance();

  switch (type) {
    case 'order_confirmation':
      await notifier.sendOrderConfirmation(data.order, data.user);
      break;
    case 'payment_receipt':
      await notifier.sendPaymentReceipt(data.transaction, data.user);
      break;
    case 'shipping':
      await notifier.sendShippingNotification(data.order, data.trackingNumber);
      break;
    default:
      await notifier.sendEmail(data);
  }

  logger.info('Email job completed', { type, jobId: job.id });
});

// Payment queue processor
paymentQueue.process(async (job) => {
  const { action, data } = job.data;
  const PaymentService = require('./PaymentService');
  const paymentService = new PaymentService();

  switch (action) {
    case 'process':
      await paymentService.processPayment(data);
      break;
    case 'refund':
      await paymentService.refundPayment(data.transactionId, data.reason);
      break;
  }

  logger.info('Payment job completed', { action, jobId: job.id });
});

// Report queue processor
reportQueue.process(async (job) => {
  const { type, params } = job.data;
  const ReportingService = require('./ReportingService');
  const reportingService = new ReportingService();

  const report = await reportingService.generateRevenueReport(params);
  logger.info('Report job completed', { type, jobId: job.id });
  return report;
});

// Queue event handlers
[emailQueue, paymentQueue, reportQueue, webhookQueue].forEach(queue => {
  queue.on('failed', (job, err) => {
    logger.error(`Job failed in ${queue.name} queue`, {
      jobId: job.id,
      error: err.message,
      attempts: job.attemptsMade,
    });
  });

  queue.on('stalled', (job) => {
    logger.warn(`Job stalled in ${queue.name} queue`, { jobId: job.id });
  });
});

module.exports = {
  emailQueue,
  paymentQueue,
  reportQueue,
  webhookQueue,
};
