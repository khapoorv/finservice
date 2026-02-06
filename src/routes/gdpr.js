const express = require('express');
const User = require('../models/User');
const Order = require('../models/Order');
const Invoice = require('../models/Invoice');
const Transaction = require('../models/Transaction');
const AuditLog = require('../models/AuditLog');
const { authenticateJWT } = require('../middleware/auth');
const logger = require('../utils/logger');

const router = express.Router();

// GDPR: Export all user data (Article 20 - Right to data portability)
router.get('/export', authenticateJWT, async (req, res) => {
  try {
    const userId = req.user.id;

    const [user, orders, invoices, transactions] = await Promise.all([
      User.findById(userId).select('+socialSecurityNumber'),
      Order.find({ customer: userId }),
      Invoice.find({ customer: userId }),
      Transaction.find({ customer: userId }),
    ]);

    const exportData = {
      exportDate: new Date().toISOString(),
      user: {
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        phone: user.phone,
        dateOfBirth: user.dateOfBirth,
        address: user.address,
        createdAt: user.createdAt,
      },
      orders: orders.map(o => ({
        orderNumber: o.orderNumber,
        total: o.total,
        status: o.status,
        createdAt: o.createdAt,
        items: o.items,
      })),
      invoices: invoices.map(i => ({
        invoiceNumber: i.invoiceNumber,
        total: i.total,
        status: i.status,
        issueDate: i.issueDate,
      })),
      transactions: transactions.map(t => ({
        transactionId: t.transactionId,
        amount: t.amount,
        type: t.type,
        status: t.status,
        createdAt: t.createdAt,
      })),
    };

    // Data export in JSON format
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Content-Disposition', `attachment; filename="user-data-export-${userId}.json"`);

    logger.info('GDPR data export', { userId });
    res.json(exportData);
  } catch (error) {
    logger.error('GDPR export failed', { error: error.message, userId: req.user.id });
    res.status(500).json({ error: 'Failed to export user data' });
  }
});

// GDPR: Delete user data (Article 17 - Right to erasure)
router.delete('/delete-account', authenticateJWT, async (req, res) => {
  try {
    const userId = req.user.id;
    const { confirmEmail } = req.body;

    const user = await User.findById(userId);
    if (!user) return res.status(404).json({ error: 'User not found' });

    if (confirmEmail !== user.email) {
      return res.status(400).json({ error: 'Email confirmation does not match' });
    }

    // Anonymize rather than hard delete (preserve transaction integrity)
    user.email = `deleted-${userId}@anonymized.local`;
    user.firstName = 'Deleted';
    user.lastName = 'User';
    user.phone = null;
    user.dateOfBirth = null;
    user.address = null;
    user.socialSecurityNumber = null;
    user.isDeleted = true;
    user.deletedAt = new Date();
    user.isActive = false;
    await user.save();

    // Anonymize orders
    await Order.updateMany(
      { customer: userId },
      {
        $set: {
          customerEmail: 'anonymized@deleted.local',
          customerPhone: null,
          'shippingAddress.fullName': 'Deleted User',
          'billingAddress.fullName': 'Deleted User',
        }
      }
    );

    logger.info('GDPR account deletion', { userId, anonymized: true });
    res.json({ message: 'Account and personal data have been deleted' });
  } catch (error) {
    logger.error('GDPR deletion failed', { error: error.message, userId: req.user.id });
    res.status(500).json({ error: 'Failed to delete account' });
  }
});

// Cookie consent management
router.post('/cookie-consent', async (req, res) => {
  const { essential, analytics, marketing, userId } = req.body;

  const consentRecord = {
    timestamp: new Date(),
    essential: true, // Always required
    analytics: !!analytics,
    marketing: !!marketing,
    ip: req.ip,
    userAgent: req.headers['user-agent'],
  };

  if (userId) {
    await User.findByIdAndUpdate(userId, {
      consentGiven: true,
      consentDate: new Date(),
    });
  }

  logger.info('Cookie consent recorded', consentRecord);
  res.json({ message: 'Consent recorded', consent: consentRecord });
});

// CCPA: Do Not Sell My Personal Information
router.post('/do-not-sell', authenticateJWT, async (req, res) => {
  try {
    await User.findByIdAndUpdate(req.user.id, {
      $set: { 'metadata.doNotSell': 'true', 'metadata.doNotSellDate': new Date().toISOString() },
    });

    logger.info('CCPA do-not-sell request', { userId: req.user.id });
    res.json({ message: 'Your data will not be sold to third parties' });
  } catch (error) {
    res.status(500).json({ error: 'Failed to process request' });
  }
});

module.exports = router;
