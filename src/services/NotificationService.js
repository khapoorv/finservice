const sgMail = require('@sendgrid/mail');
const twilio = require('twilio');
const logger = require('../utils/logger');

// Singleton pattern - only one instance of notification service
let instance = null;

class NotificationService {
  constructor() {
    if (instance) {
      return instance;
    }

    // Initialize SendGrid
    sgMail.setApiKey(process.env.SENDGRID_API_KEY);
    this.fromEmail = process.env.SENDGRID_FROM_EMAIL || 'noreply@fincommerce.io';

    // Initialize Twilio
    this.twilioClient = twilio(
      process.env.TWILIO_ACCOUNT_SID,
      process.env.TWILIO_AUTH_TOKEN
    );
    this.twilioPhone = process.env.TWILIO_PHONE_NUMBER;

    instance = this;
  }

  static getInstance() {
    if (!instance) {
      instance = new NotificationService();
    }
    return instance;
  }

  // Send email via SendGrid
  async sendEmail({ to, subject, html, text }) {
    try {
      await sgMail.send({
        to,
        from: this.fromEmail,
        subject,
        html,
        text: text || html.replace(/<[^>]*>/g, ''),
      });
      logger.info('Email sent', { to, subject });
    } catch (error) {
      logger.error('Email send failed', { to, subject, error: error.message });
      throw error;
    }
  }

  // Send SMS via Twilio
  async sendSMS({ to, body }) {
    try {
      const message = await this.twilioClient.messages.create({
        body,
        from: this.twilioPhone,
        to,
      });
      logger.info('SMS sent', { to, messageId: message.sid });
      return message;
    } catch (error) {
      logger.error('SMS send failed', { to, error: error.message });
      throw error;
    }
  }

  // Order confirmation notification
  async sendOrderConfirmation(order, user) {
    await this.sendEmail({
      to: user.email,
      subject: `Order Confirmed - ${order.orderNumber}`,
      html: `
        <h1>Order Confirmed!</h1>
        <p>Hi ${user.firstName},</p>
        <p>Your order <strong>${order.orderNumber}</strong> has been confirmed.</p>
        <p>Total: $${order.total.toFixed(2)}</p>
        <p>We'll notify you when it ships.</p>
      `,
    });

    if (user.phone) {
      await this.sendSMS({
        to: user.phone,
        body: `FinCommerce: Order ${order.orderNumber} confirmed! Total: $${order.total.toFixed(2)}`,
      });
    }
  }

  // Payment receipt
  async sendPaymentReceipt(transaction, user) {
    await this.sendEmail({
      to: user.email,
      subject: `Payment Receipt - $${transaction.amount.toFixed(2)}`,
      html: `
        <h1>Payment Received</h1>
        <p>Transaction ID: ${transaction.transactionId}</p>
        <p>Amount: $${transaction.amount.toFixed(2)} ${transaction.currency}</p>
        <p>Date: ${transaction.processedAt.toISOString()}</p>
      `,
    });
  }

  // Shipping notification
  async sendShippingNotification(order, trackingNumber) {
    await this.sendEmail({
      to: order.customerEmail,
      subject: `Your Order Has Shipped - ${order.orderNumber}`,
      html: `
        <h1>Your Order Has Shipped!</h1>
        <p>Order: ${order.orderNumber}</p>
        <p>Tracking Number: ${trackingNumber}</p>
      `,
    });
  }
}

module.exports = NotificationService;
