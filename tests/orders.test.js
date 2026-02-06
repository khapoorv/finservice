const request = require('supertest');
const mongoose = require('mongoose');
const app = require('../src/app');
const Order = require('../src/models/Order');
const { Product } = require('../src/models/Product');
const User = require('../src/models/User');

describe('Orders API', () => {
  let authToken;
  let testProduct;

  beforeAll(async () => {
    await mongoose.connect(process.env.DATABASE_URL || 'mongodb://localhost:27017/fincommerce_test');

    await User.create({
      email: 'orders-test@example.com',
      password: 'SecureP@ss123',
      firstName: 'Order',
      lastName: 'Tester',
    });

    const loginRes = await request(app)
      .post('/api/auth/login')
      .send({ email: 'orders-test@example.com', password: 'SecureP@ss123' });
    authToken = loginRes.body.token;

    testProduct = await Product.create({
      name: 'Test Widget',
      price: 19.99,
      sku: 'TEST-001',
      category: 'electronics',
      stock: 100,
    });
  });

  afterAll(async () => {
    await User.deleteMany({});
    await Product.deleteMany({});
    await Order.deleteMany({});
    await mongoose.connection.close();
  });

  describe('POST /api/orders', () => {
    it('should create an order', async () => {
      const res = await request(app)
        .post('/api/orders')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          items: [{ productId: testProduct._id.toString(), quantity: 2 }],
          shippingAddress: {
            street: '456 Order St',
            city: 'OrderCity',
            state: 'OC',
            zipCode: '67890',
            country: 'US',
          },
        });

      expect(res.status).toBe(201);
      expect(res.body).toHaveProperty('orderNumber');
      expect(res.body.items).toHaveLength(1);
      expect(res.body.subtotal).toBe(39.98);
    });

    it('should require authentication', async () => {
      const res = await request(app)
        .post('/api/orders')
        .send({
          items: [{ productId: testProduct._id.toString(), quantity: 1 }],
          shippingAddress: {
            street: '789 NoAuth St',
            city: 'NoAuthCity',
            state: 'NA',
            zipCode: '00000',
            country: 'US',
          },
        });

      expect(res.status).toBe(401);
    });

    it('should validate order items', async () => {
      const res = await request(app)
        .post('/api/orders')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          items: [], // Empty items array
          shippingAddress: {
            street: '123 St',
            city: 'City',
            state: 'ST',
            zipCode: '12345',
            country: 'US',
          },
        });

      expect(res.status).toBe(400);
    });

    it('should reject non-existent product', async () => {
      const res = await request(app)
        .post('/api/orders')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          items: [{ productId: new mongoose.Types.ObjectId().toString(), quantity: 1 }],
          shippingAddress: {
            street: '123 St',
            city: 'City',
            state: 'ST',
            zipCode: '12345',
            country: 'US',
          },
        });

      expect(res.status).toBe(400);
    });
  });

  describe('GET /api/orders', () => {
    it('should list user orders', async () => {
      const res = await request(app)
        .get('/api/orders')
        .set('Authorization', `Bearer ${authToken}`);

      expect(res.status).toBe(200);
      expect(res.body.orders).toBeDefined();
      expect(res.body.total).toBeGreaterThanOrEqual(1);
    });
  });

  describe('POST /api/orders/:id/cancel', () => {
    it('should cancel a pending order', async () => {
      // Create a new order to cancel
      const orderRes = await request(app)
        .post('/api/orders')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          items: [{ productId: testProduct._id.toString(), quantity: 1 }],
          shippingAddress: {
            street: '123 Cancel St',
            city: 'CancelCity',
            state: 'CC',
            zipCode: '11111',
            country: 'US',
          },
        });

      const res = await request(app)
        .post(`/api/orders/${orderRes.body._id}/cancel`)
        .set('Authorization', `Bearer ${authToken}`);

      expect(res.status).toBe(200);
      expect(res.body.order.status).toBe('cancelled');
    });
  });
});
