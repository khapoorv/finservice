const rateLimit = require('express-rate-limit');
const logger = require('../utils/logger');

// Global rate limiter
const globalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100,
  message: { error: 'Too many requests, please try again later' },
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res, next, options) => {
    logger.warn('Rate limit exceeded', {
      ip: req.ip,
      path: req.path,
      limit: options.max,
    });
    res.status(options.statusCode).json(options.message);
  },
});

// Strict limiter for auth endpoints
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  message: { error: 'Too many login attempts, please try again in 15 minutes' },
  skipSuccessfulRequests: true,
});

// Payment endpoint limiter
const paymentLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 10,
  message: { error: 'Too many payment requests, please slow down' },
});

module.exports = globalLimiter;
module.exports.authLimiter = authLimiter;
module.exports.paymentLimiter = paymentLimiter;
