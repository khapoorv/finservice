const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
const mongoose = require('mongoose');
const { createServer } = require('http');

const config = require('./config/database');
const redisClient = require('./config/redis');
const logger = require('./utils/logger');
const rateLimiter = require('./middleware/rateLimiter');
const auditMiddleware = require('./middleware/audit');

const authRoutes = require('./routes/auth');
const productRoutes = require('./routes/products');
const orderRoutes = require('./routes/orders');
const paymentRoutes = require('./routes/payments');
const invoiceRoutes = require('./routes/invoices');
const reportRoutes = require('./routes/reports');
const adminRoutes = require('./routes/admin');
const gdprRoutes = require('./routes/gdpr');
const healthRoutes = require('./routes/health');

const EventBus = require('./events/EventBus');
require('./events/handlers/orderEvents');
require('./events/handlers/paymentEvents');

const app = express();

// Security headers
app.use(helmet());
app.use(helmet.contentSecurityPolicy({
  directives: {
    defaultSrc: ["'self'"],
    scriptSrc: ["'self'", "'unsafe-inline'"],
    styleSrc: ["'self'", "'unsafe-inline'"],
    imgSrc: ["'self'", 'data:', 'https:'],
  }
}));

// CORS configuration
app.use(cors({
  origin: process.env.CORS_ORIGIN || 'http://localhost:8080',
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-CSRF-Token']
}));

// Body parsing
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Global middleware chain
app.use(rateLimiter);
app.use(auditMiddleware);

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/products', productRoutes);
app.use('/api/orders', orderRoutes);
app.use('/api/payments', paymentRoutes);
app.use('/api/invoices', invoiceRoutes);
app.use('/api/reports', reportRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/gdpr', gdprRoutes);
app.use('/api/health', healthRoutes);

// Error handling middleware
app.use((err, req, res, next) => {
  logger.error('Unhandled error', { error: err.message, stack: err.stack });
  res.status(err.status || 500).json({
    error: process.env.NODE_ENV === 'production' ? 'Internal server error' : err.message
  });
});

// Database connection and server start
const PORT = process.env.PORT || 3000;

async function startServer() {
  try {
    await mongoose.connect(config.databaseUrl, config.mongooseOptions);
    logger.info('Connected to MongoDB');

    await redisClient.connect();
    logger.info('Connected to Redis');

    EventBus.getInstance().emit('app:ready');

    const server = createServer(app);
    server.listen(PORT, () => {
      logger.info(`FinCommerce API server listening on port ${PORT}`);
    });
  } catch (error) {
    logger.error('Failed to start server', { error: error.message });
    process.exit(1);
  }
}

startServer();

module.exports = app;
