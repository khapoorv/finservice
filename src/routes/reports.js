const express = require('express');
const Order = require('../models/Order');
const Transaction = require('../models/Transaction');
const Invoice = require('../models/Invoice');
const { authenticateJWT, requireRole } = require('../middleware/auth');
const ReportingService = require('../services/ReportingService');
const logger = require('../utils/logger');

const router = express.Router();

// Revenue report
router.get('/revenue', authenticateJWT, requireRole('admin', 'vendor'), async (req, res) => {
  try {
    const { startDate, endDate, groupBy = 'day' } = req.query;
    const reportingService = new ReportingService();

    const report = await reportingService.generateRevenueReport({
      startDate: new Date(startDate),
      endDate: new Date(endDate),
      groupBy,
      userId: req.user.role === 'vendor' ? req.user.id : null,
    });

    res.json(report);
  } catch (error) {
    logger.error('Revenue report failed', { error: error.message });
    res.status(500).json({ error: 'Failed to generate revenue report' });
  }
});

// Transaction summary
router.get('/transactions', authenticateJWT, requireRole('admin'), async (req, res) => {
  try {
    const { startDate, endDate } = req.query;
    const filter = {};
    if (startDate) filter.createdAt = { $gte: new Date(startDate) };
    if (endDate) filter.createdAt = { ...filter.createdAt, $lte: new Date(endDate) };

    const summary = await Transaction.aggregate([
      { $match: filter },
      {
        $group: {
          _id: '$status',
          count: { $sum: 1 },
          totalAmount: { $sum: '$amount' },
        }
      },
    ]);

    res.json({ summary });
  } catch (error) {
    res.status(500).json({ error: 'Failed to generate transaction summary' });
  }
});

// Export data as CSV
router.get('/export/:type', authenticateJWT, requireRole('admin'), async (req, res) => {
  try {
    const { type } = req.params;
    const { startDate, endDate, format = 'csv' } = req.query;
    const reportingService = new ReportingService();

    const data = await reportingService.exportData({
      type,
      startDate: new Date(startDate),
      endDate: new Date(endDate),
      format,
    });

    if (format === 'csv') {
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', `attachment; filename="${type}-report.csv"`);
      res.send(data);
    } else {
      res.json(data);
    }
  } catch (error) {
    logger.error('Data export failed', { error: error.message, type: req.params.type });
    res.status(500).json({ error: 'Failed to export data' });
  }
});

// Invoice aging report
router.get('/invoice-aging', authenticateJWT, requireRole('admin'), async (req, res) => {
  try {
    const now = new Date();
    const aging = await Invoice.aggregate([
      { $match: { status: { $in: ['sent', 'overdue'] } } },
      {
        $project: {
          total: 1,
          daysOutstanding: {
            $divide: [{ $subtract: [now, '$issueDate'] }, 86400000],
          },
        }
      },
      {
        $bucket: {
          groupBy: '$daysOutstanding',
          boundaries: [0, 30, 60, 90, 120],
          default: '120+',
          output: { count: { $sum: 1 }, totalAmount: { $sum: '$total' } },
        }
      },
    ]);

    res.json({ aging });
  } catch (error) {
    res.status(500).json({ error: 'Failed to generate aging report' });
  }
});

module.exports = router;
