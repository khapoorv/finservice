const Order = require('../models/Order');
const Transaction = require('../models/Transaction');
const Invoice = require('../models/Invoice');
const logger = require('../utils/logger');

class ReportingService {
  // Generate revenue report with grouping
  async generateRevenueReport({ startDate, endDate, groupBy, userId }) {
    const matchFilter = {
      paymentStatus: 'paid',
      createdAt: { $gte: startDate, $lte: endDate },
    };
    if (userId) matchFilter.customer = userId;

    const groupByFormat = {
      day: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } },
      week: { $dateToString: { format: '%Y-W%V', date: '$createdAt' } },
      month: { $dateToString: { format: '%Y-%m', date: '$createdAt' } },
    };

    const report = await Order.aggregate([
      { $match: matchFilter },
      {
        $group: {
          _id: groupByFormat[groupBy] || groupByFormat.day,
          revenue: { $sum: '$total' },
          orderCount: { $sum: 1 },
          avgOrderValue: { $avg: '$total' },
          taxCollected: { $sum: '$tax' },
        }
      },
      { $sort: { _id: 1 } },
    ]);

    return {
      period: { startDate, endDate, groupBy },
      data: report,
      summary: {
        totalRevenue: report.reduce((sum, r) => sum + r.revenue, 0),
        totalOrders: report.reduce((sum, r) => sum + r.orderCount, 0),
        totalTax: report.reduce((sum, r) => sum + r.taxCollected, 0),
      },
    };
  }

  // Export data in various formats
  async exportData({ type, startDate, endDate, format }) {
    let data;

    switch (type) {
      case 'orders':
        data = await Order.find({
          createdAt: { $gte: startDate, $lte: endDate },
        }).lean();
        break;
      case 'transactions':
        data = await Transaction.find({
          createdAt: { $gte: startDate, $lte: endDate },
        }).lean();
        break;
      case 'invoices':
        data = await Invoice.find({
          createdAt: { $gte: startDate, $lte: endDate },
        }).lean();
        break;
      default:
        throw new Error(`Unknown export type: ${type}`);
    }

    if (format === 'csv') {
      return this.convertToCSV(data);
    }

    return data;
  }

  // Convert data to CSV format for data export
  convertToCSV(data) {
    if (!data.length) return '';
    const headers = Object.keys(data[0]).filter(k => k !== '__v');
    const rows = data.map(item =>
      headers.map(header => {
        const val = item[header];
        if (val === null || val === undefined) return '';
        if (typeof val === 'object') return JSON.stringify(val);
        return String(val).includes(',') ? `"${val}"` : val;
      }).join(',')
    );
    return [headers.join(','), ...rows].join('\n');
  }

  // Retention policy enforcement
  // Invoices: 7 years, Transactions: 5 years, Orders: 3 years
  async enforceRetentionPolicies() {
    const now = new Date();

    // Archive old orders (beyond 3 years)
    const orderCutoff = new Date(now);
    orderCutoff.setFullYear(orderCutoff.getFullYear() - 3);

    const archivedOrders = await Order.updateMany(
      { createdAt: { $lt: orderCutoff }, status: { $in: ['delivered', 'cancelled'] } },
      { $set: { archived: true } }
    );

    logger.info('Retention policy enforced', {
      archivedOrders: archivedOrders.modifiedCount,
    });

    return { archivedOrders: archivedOrders.modifiedCount };
  }
}

module.exports = ReportingService;
