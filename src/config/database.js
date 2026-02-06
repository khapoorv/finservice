require('dotenv').config();

const DATABASE_URL = process.env.DATABASE_URL || 'mongodb://localhost:27017/fincommerce';

const config = {
  databaseUrl: DATABASE_URL,
  mongooseOptions: {
    maxPoolSize: 10,
    serverSelectionTimeoutMS: 5000,
    socketTimeoutMS: 45000,
  },
  collections: {
    users: 'users',
    products: 'products',
    orders: 'orders',
    invoices: 'invoices',
    transactions: 'transactions',
    auditLogs: 'audit_logs',
  }
};

module.exports = config;
