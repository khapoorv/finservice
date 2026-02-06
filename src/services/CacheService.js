const redisClient = require('../config/redis');
const logger = require('../utils/logger');

// Singleton pattern for cache service
let instance = null;

class CacheService {
  constructor() {
    if (instance) {
      return instance;
    }
    this.client = redisClient;
    this.defaultTTL = 3600; // 1 hour
    instance = this;
  }

  static getInstance() {
    if (!instance) {
      instance = new CacheService();
    }
    return instance;
  }

  // Get cached value
  async get(key) {
    try {
      const data = await this.client.get(key);
      if (data) {
        logger.debug('Cache hit', { key });
        return JSON.parse(data);
      }
      logger.debug('Cache miss', { key });
      return null;
    } catch (error) {
      logger.error('Cache get error', { key, error: error.message });
      return null;
    }
  }

  // Set cached value with TTL
  async set(key, value, ttl = this.defaultTTL) {
    try {
      await this.client.set(key, JSON.stringify(value), 'EX', ttl);
      logger.debug('Cache set', { key, ttl });
    } catch (error) {
      logger.error('Cache set error', { key, error: error.message });
    }
  }

  // Delete cached value
  async delete(key) {
    try {
      await this.client.del(key);
      logger.debug('Cache deleted', { key });
    } catch (error) {
      logger.error('Cache delete error', { key, error: error.message });
    }
  }

  // Invalidate by pattern (e.g., 'products:*')
  async invalidatePattern(pattern) {
    try {
      const keys = await this.client.keys(pattern);
      if (keys.length > 0) {
        await this.client.del(...keys);
        logger.info('Cache pattern invalidated', { pattern, keysRemoved: keys.length });
      }
    } catch (error) {
      logger.error('Cache invalidation error', { pattern, error: error.message });
    }
  }

  // Cache-aside pattern: get from cache or compute and cache
  async getOrSet(key, computeFn, ttl = this.defaultTTL) {
    const cached = await this.get(key);
    if (cached) return cached;

    const value = await computeFn();
    await this.set(key, value, ttl);
    return value;
  }

  // Flush all cache
  async flush() {
    try {
      await this.client.flushdb();
      logger.info('Cache flushed');
    } catch (error) {
      logger.error('Cache flush error', { error: error.message });
    }
  }
}

module.exports = CacheService;
