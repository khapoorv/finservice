const request = require('supertest');
const mongoose = require('mongoose');
const app = require('../src/app');
const User = require('../src/models/User');
const Order = require('../src/models/Order');

describe('GDPR API', () => {
  let authToken;
  let testUser;

  beforeAll(async () => {
    await mongoose.connect(process.env.DATABASE_URL || 'mongodb://localhost:27017/fincommerce_test');

    testUser = await User.create({
      email: 'gdpr-test@example.com',
      password: 'SecureP@ss123',
      firstName: 'GDPR',
      lastName: 'Tester',
      phone: '+1234567890',
      address: {
        street: '100 Privacy Lane',
        city: 'DataCity',
        state: 'DC',
        zipCode: '55555',
        country: 'US',
      },
    });

    const loginRes = await request(app)
      .post('/api/auth/login')
      .send({ email: 'gdpr-test@example.com', password: 'SecureP@ss123' });
    authToken = loginRes.body.token;
  });

  afterAll(async () => {
    await User.deleteMany({});
    await Order.deleteMany({});
    await mongoose.connection.close();
  });

  describe('GET /api/gdpr/export', () => {
    it('should export user data', async () => {
      const res = await request(app)
        .get('/api/gdpr/export')
        .set('Authorization', `Bearer ${authToken}`);

      expect(res.status).toBe(200);
      expect(res.body.user).toBeDefined();
      expect(res.body.user.email).toBe('gdpr-test@example.com');
      expect(res.body.user.firstName).toBe('GDPR');
      expect(res.body.orders).toBeDefined();
      expect(res.body.invoices).toBeDefined();
      expect(res.body.transactions).toBeDefined();
    });

    it('should require authentication for export', async () => {
      const res = await request(app).get('/api/gdpr/export');
      expect(res.status).toBe(401);
    });
  });

  describe('POST /api/gdpr/cookie-consent', () => {
    it('should record cookie consent', async () => {
      const res = await request(app)
        .post('/api/gdpr/cookie-consent')
        .send({
          essential: true,
          analytics: true,
          marketing: false,
          userId: testUser._id.toString(),
        });

      expect(res.status).toBe(200);
      expect(res.body.consent.essential).toBe(true);
      expect(res.body.consent.analytics).toBe(true);
      expect(res.body.consent.marketing).toBe(false);
    });

    it('should work without userId (anonymous)', async () => {
      const res = await request(app)
        .post('/api/gdpr/cookie-consent')
        .send({ essential: true, analytics: false, marketing: false });

      expect(res.status).toBe(200);
    });
  });

  describe('DELETE /api/gdpr/delete-account', () => {
    it('should require email confirmation', async () => {
      const res = await request(app)
        .delete('/api/gdpr/delete-account')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ confirmEmail: 'wrong@email.com' });

      expect(res.status).toBe(400);
      expect(res.body.error).toContain('does not match');
    });

    it('should anonymize user data on deletion', async () => {
      const res = await request(app)
        .delete('/api/gdpr/delete-account')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ confirmEmail: 'gdpr-test@example.com' });

      expect(res.status).toBe(200);

      // Verify user is anonymized
      const deletedUser = await User.findById(testUser._id).setOptions({ includeDeleted: true });
      expect(deletedUser.isDeleted).toBe(true);
      expect(deletedUser.firstName).toBe('Deleted');
      expect(deletedUser.email).toContain('anonymized');
    });
  });

  describe('POST /api/gdpr/do-not-sell', () => {
    it('should require authentication', async () => {
      const res = await request(app).post('/api/gdpr/do-not-sell');
      expect(res.status).toBe(401);
    });
  });
});
