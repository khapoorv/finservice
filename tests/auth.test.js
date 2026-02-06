const request = require('supertest');
const mongoose = require('mongoose');
const app = require('../src/app');
const User = require('../src/models/User');

describe('Auth API', () => {
  beforeAll(async () => {
    await mongoose.connect(process.env.DATABASE_URL || 'mongodb://localhost:27017/fincommerce_test');
  });

  afterAll(async () => {
    await User.deleteMany({});
    await mongoose.connection.close();
  });

  describe('POST /api/auth/register', () => {
    it('should register a new user', async () => {
      const res = await request(app)
        .post('/api/auth/register')
        .send({
          email: 'test@example.com',
          password: 'SecureP@ss123',
          firstName: 'Test',
          lastName: 'User',
        });

      expect(res.status).toBe(201);
      expect(res.body).toHaveProperty('token');
      expect(res.body.user).toHaveProperty('email', 'test@example.com');
      expect(res.body.user).not.toHaveProperty('password');
    });

    it('should reject duplicate email', async () => {
      const res = await request(app)
        .post('/api/auth/register')
        .send({
          email: 'test@example.com',
          password: 'AnotherP@ss123',
          firstName: 'Duplicate',
          lastName: 'User',
        });

      expect(res.status).toBe(409);
      expect(res.body.error).toContain('already registered');
    });

    it('should validate email format', async () => {
      const res = await request(app)
        .post('/api/auth/register')
        .send({
          email: 'not-an-email',
          password: 'SecureP@ss123',
          firstName: 'Test',
          lastName: 'User',
        });

      expect(res.status).toBe(400);
    });

    it('should reject weak passwords', async () => {
      const res = await request(app)
        .post('/api/auth/register')
        .send({
          email: 'weak@example.com',
          password: '123',
          firstName: 'Test',
          lastName: 'User',
        });

      expect(res.status).toBe(400);
    });
  });

  describe('POST /api/auth/login', () => {
    it('should login with valid credentials', async () => {
      const res = await request(app)
        .post('/api/auth/login')
        .send({
          email: 'test@example.com',
          password: 'SecureP@ss123',
        });

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('token');
    });

    it('should reject invalid password', async () => {
      const res = await request(app)
        .post('/api/auth/login')
        .send({
          email: 'test@example.com',
          password: 'wrongpassword',
        });

      expect(res.status).toBe(401);
    });

    it('should reject non-existent user', async () => {
      const res = await request(app)
        .post('/api/auth/login')
        .send({
          email: 'nobody@example.com',
          password: 'anypassword',
        });

      expect(res.status).toBe(401);
    });
  });

  describe('GET /api/auth/me', () => {
    it('should return user profile with valid token', async () => {
      const loginRes = await request(app)
        .post('/api/auth/login')
        .send({ email: 'test@example.com', password: 'SecureP@ss123' });

      const res = await request(app)
        .get('/api/auth/me')
        .set('Authorization', `Bearer ${loginRes.body.token}`);

      expect(res.status).toBe(200);
      expect(res.body.email).toBe('test@example.com');
    });

    it('should reject request without token', async () => {
      const res = await request(app).get('/api/auth/me');
      expect(res.status).toBe(401);
    });
  });
});
