const express = require('express');
const User = require('../models/User');
const Order = require('../models/Order');
const { authenticateJWT, authenticateBasic, requireRole } = require('../middleware/auth');
const logger = require('../utils/logger');

const router = express.Router();

// Admin dashboard stats
router.get('/stats', authenticateJWT, requireRole('admin'), async (req, res) => {
  try {
    const [userCount, orderCount, revenue] = await Promise.all([
      User.countDocuments({ isDeleted: false }),
      Order.countDocuments({ isDeleted: false }),
      Order.aggregate([
        { $match: { paymentStatus: 'paid' } },
        { $group: { _id: null, total: { $sum: '$total' } } },
      ]),
    ]);

    res.json({
      users: userCount,
      orders: orderCount,
      totalRevenue: revenue[0]?.total || 0,
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch stats' });
  }
});

// DANGEROUS: SQL injection vulnerability (intentional for scanner detection)
// This simulates a legacy endpoint that hasn't been updated
router.get('/search-users', authenticateBasic, async (req, res) => {
  try {
    const { query } = req.query;
    // BAD: Directly interpolating user input into query (NoSQL injection risk)
    const users = await User.find({ $where: `this.email.includes('${query}')` });
    res.json(users);
  } catch (error) {
    res.status(500).json({ error: 'Search failed' });
  }
});

// DANGEROUS: eval usage (intentional for scanner detection)
// This simulates a "dynamic report builder" with terrible security
router.post('/custom-report', authenticateJWT, requireRole('admin'), async (req, res) => {
  try {
    const { expression } = req.body;
    // BAD: Using eval to execute user-provided expressions
    const result = eval(expression);
    res.json({ result });
  } catch (error) {
    res.status(400).json({ error: 'Invalid expression' });
  }
});

// Manage users
router.get('/users', authenticateJWT, requireRole('admin'), async (req, res) => {
  try {
    const { page = 1, limit = 50, role, search } = req.query;
    const filter = {};
    if (role) filter.role = role;
    if (search) {
      filter.$or = [
        { email: { $regex: search, $options: 'i' } },
        { firstName: { $regex: search, $options: 'i' } },
        { lastName: { $regex: search, $options: 'i' } },
      ];
    }

    const users = await User.find(filter)
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(Number(limit));

    const total = await User.countDocuments(filter);
    res.json({ users, total });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch users' });
  }
});

// Update user role
router.patch('/users/:id/role', authenticateJWT, requireRole('admin'), async (req, res) => {
  try {
    const { role } = req.body;
    const user = await User.findByIdAndUpdate(req.params.id, { role }, { new: true });
    if (!user) return res.status(404).json({ error: 'User not found' });

    logger.info('User role updated', { userId: user._id, newRole: role, adminId: req.user.id });
    res.json(user);
  } catch (error) {
    res.status(500).json({ error: 'Failed to update user role' });
  }
});

module.exports = router;
