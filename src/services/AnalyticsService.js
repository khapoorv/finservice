const logger = require('../utils/logger');

// Third-party analytics integrations
class AnalyticsService {
  constructor() {
    // Google Analytics initialization
    this.gaTrackingId = process.env.GA_TRACKING_ID;

    // Mixpanel initialization
    this.mixpanelToken = process.env.MIXPANEL_TOKEN;
    this.Mixpanel = null;
    if (this.mixpanelToken) {
      try {
        this.Mixpanel = require('mixpanel').init(this.mixpanelToken);
      } catch (e) {
        logger.warn('Mixpanel SDK not available');
      }
    }

    // Segment initialization
    this.segmentWriteKey = process.env.SEGMENT_WRITE_KEY;
    this.Analytics = null;
    if (this.segmentWriteKey) {
      try {
        const Analytics = require('analytics-node');
        this.Analytics = new Analytics(this.segmentWriteKey);
      } catch (e) {
        logger.warn('Segment SDK not available');
      }
    }
  }

  // Track event across all analytics platforms
  trackEvent(eventName, properties, userId = null) {
    this.trackMixpanel(eventName, properties, userId);
    this.trackSegment(eventName, properties, userId);
    this.trackGA(eventName, properties);

    logger.info('Analytics event tracked', { eventName, userId });
  }

  // Mixpanel tracking
  trackMixpanel(eventName, properties, userId) {
    if (!this.Mixpanel) return;

    try {
      if (userId) {
        this.Mixpanel.track(eventName, { ...properties, distinct_id: userId });
      } else {
        this.Mixpanel.track(eventName, properties);
      }
    } catch (error) {
      logger.error('Mixpanel tracking failed', { eventName, error: error.message });
    }
  }

  // Segment tracking
  trackSegment(eventName, properties, userId) {
    if (!this.Analytics) return;

    try {
      if (userId) {
        this.Analytics.track({ userId, event: eventName, properties });
      } else {
        this.Analytics.track({ anonymousId: 'server', event: eventName, properties });
      }
    } catch (error) {
      logger.error('Segment tracking failed', { eventName, error: error.message });
    }
  }

  // Google Analytics measurement protocol
  trackGA(eventName, properties) {
    if (!this.gaTrackingId) return;

    // Server-side GA tracking via Measurement Protocol
    const payload = {
      v: '1',
      tid: this.gaTrackingId,
      cid: properties.clientId || '555',
      t: 'event',
      ec: properties.category || 'server',
      ea: eventName,
      el: properties.label || '',
      ev: properties.value || 0,
    };

    logger.debug('GA event queued', { eventName, trackingId: this.gaTrackingId });
  }

  // Identify user across platforms
  identifyUser(userId, traits) {
    if (this.Mixpanel) {
      this.Mixpanel.people.set(userId, traits);
    }

    if (this.Analytics) {
      this.Analytics.identify({ userId, traits });
    }

    logger.info('User identified in analytics', { userId });
  }

  // Track page view
  trackPageView(url, userId = null) {
    this.trackEvent('page_view', { url }, userId);
  }

  // E-commerce specific tracking
  trackPurchase(order, userId) {
    this.trackEvent('purchase', {
      orderId: order.orderNumber,
      total: order.total,
      items: order.items.length,
      currency: 'USD',
    }, userId);
  }

  trackAddToCart(product, userId) {
    this.trackEvent('add_to_cart', {
      productId: product._id,
      productName: product.name,
      price: product.price,
      category: product.category,
    }, userId);
  }
}

module.exports = AnalyticsService;
