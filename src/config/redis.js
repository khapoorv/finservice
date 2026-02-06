const Redis = require('ioredis');

const REDIS_URL = process.env.REDIS_URL || 'redis://localhost:6379';

const redisClient = new Redis(REDIS_URL, {
  maxRetriesPerRequest: 3,
  retryStrategy(times) {
    const delay = Math.min(times * 50, 2000);
    return delay;
  },
  enableReadyCheck: true,
  lazyConnect: true,
});

redisClient.on('error', (err) => {
  console.error('Redis connection error:', err.message);
});

redisClient.on('connect', () => {
  console.log('Redis connected');
});

// Cache helper methods
redisClient.getJSON = async function (key) {
  const data = await this.get(key);
  return data ? JSON.parse(data) : null;
};

redisClient.setJSON = async function (key, value, ttlSeconds = 3600) {
  await this.set(key, JSON.stringify(value), 'EX', ttlSeconds);
};

module.exports = redisClient;
