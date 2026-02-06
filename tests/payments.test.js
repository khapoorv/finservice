const request = require('supertest');
const mongoose = require('mongoose');
const app = require('../src/app');
const Order = require('../src/models/Order');
const Transaction = require('../src/models/Transaction');
const User = require('../src/models/User');

describe('Payments API', () => {
  let authToken;
  let testOrder;

  beforeAll(async () => {
    await mongoose.connect(process.env.DATABASE_URL || 'mongodb://localhost:27017/fincommerce_test');

    // Create test user
    const user = await User.create({
      email: 'payment-test@example.com',
      password: 'SecureP@ss123',
      firstName: 'Payment',
      lastName: 'Tester',
    });

    // Login to get token
    const loginRes = await request(app)
      .post('/api/auth/login')
      .send({ email: 'payment-test@example.com', password: 'SecureP@ss123' });
    authToken = loginRes.body.token;

    // Create test order
    testOrder = await Order.create({
      customer: user._id,
      customerEmail: user.email,
      shippingAddress: {
        fullName: 'Payment Tester',
        street: '123 Test St',
        city: 'TestCity',
        state: 'TS',
        zipCode: '12345',
        country: 'US',
      },
      items: [{
        product: new mongoose.Types.ObjectId(),
        productName: 'Test Product',
        quantity: 1,
        unitPrice: 29.99,
        totalPrice: 29.99,
      }],
      subtotal: 29.99,
      tax: 2.40,
      total: 32.39,
    });
  });

  afterAll(async () => {
    await User.deleteMany({});
    await Order.deleteMany({});
    await Transaction.deleteMany({});
    await mongoose.connection.close();
  });

  describe('POST /api/payments/charge', () => {
    it('should require authentication', async () => {
      const res = await request(app)
        .post('/api/payments/charge')
        .send({ orderId: testOrder._id, paymentMethod: 'stripe', token: 'tok_test' });

      expect(res.status).toBe(401);
    });

    it('should validate payment request body', async () => {
      const res = await request(app)
        .post('/api/payments/charge')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ orderId: testOrder._id }); // Missing paymentMethod

      expect(res.status).toBe(400);
    });

    it('should reject invalid order ID', async () => {
      const res = await request(app)
        .post('/api/payments/charge')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          orderId: new mongoose.Types.ObjectId().toString(),
          paymentMethod: 'stripe',
          token: 'tok_test',
        });

      expect(res.status).toBe(400);
    });
  });

  describe('GET /api/payments/history', () => {
    it('should return empty history for new user', async () => {
      const res = await request(app)
        .get('/api/payments/history')
        .set('Authorization', `Bearer ${authToken}`);

      expect(res.status).toBe(200);
      expect(res.body.transactions).toHaveLength(0);
    });
  });

  describe('POST /api/payments/refund/:transactionId', () => {
    it('should reject refund for non-existent transaction', async () => {
      const res = await request(app)
        .post('/api/payments/refund/non-existent-id')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ reason: 'test refund' });

      expect(res.status).toBe(400);
    });
  });
});
