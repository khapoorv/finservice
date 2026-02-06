const express = require('express');
const mongoose = require('mongoose');
const redisClient = require('../config/redis');

const router = express.Router();

// Health check endpoint
router.get('/', async (req, res) => {
  const health = {
    status: 'ok',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    environment: process.env.NODE_ENV || 'development',
    version: require('../../package.json').version,
    checks: {},
  };

  // Check MongoDB
  try {
    const mongoState = mongoose.connection.readyState;
    health.checks.mongodb = {
      status: mongoState === 1 ? 'healthy' : 'unhealthy',
      responseTime: null,
    };
    if (mongoState === 1) {
      const start = Date.now();
      await mongoose.connection.db.admin().ping();
      health.checks.mongodb.responseTime = `${Date.now() - start}ms`;
    }
  } catch (error) {
    health.checks.mongodb = { status: 'unhealthy', error: error.message };
    health.status = 'degraded';
  }

  // Check Redis
  try {
    const start = Date.now();
    await redisClient.ping();
    health.checks.redis = {
      status: 'healthy',
      responseTime: `${Date.now() - start}ms`,
    };
  } catch (error) {
    health.checks.redis = { status: 'unhealthy', error: error.message };
    health.status = 'degraded';
  }

  // Memory usage
  const memUsage = process.memoryUsage();
  health.checks.memory = {
    heapUsed: `${Math.round(memUsage.heapUsed / 1024 / 1024)}MB`,
    heapTotal: `${Math.round(memUsage.heapTotal / 1024 / 1024)}MB`,
    rss: `${Math.round(memUsage.rss / 1024 / 1024)}MB`,
  };

  const statusCode = health.status === 'ok' ? 200 : 503;
  res.status(statusCode).json(health);
});

module.exports = router;
