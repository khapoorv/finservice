const EventEmitter = require('events');
const logger = require('../utils/logger');

// Observer pattern - centralized event bus using EventEmitter
let instance = null;

class EventBus extends EventEmitter {
  constructor() {
    super();
    if (instance) {
      return instance;
    }

    this.setMaxListeners(50);
    instance = this;

    // Log all events in development
    if (process.env.NODE_ENV !== 'production') {
      this.onAny = (eventName, ...args) => {
        logger.debug('Event emitted', { event: eventName });
      };
    }
  }

  static getInstance() {
    if (!instance) {
      instance = new EventBus();
    }
    return instance;
  }

  // Emit with error handling
  safeEmit(eventName, data) {
    try {
      this.emit(eventName, data);
    } catch (error) {
      logger.error('Event handler error', { event: eventName, error: error.message });
    }
  }

  // Subscribe with automatic error handling
  subscribe(eventName, handler) {
    this.on(eventName, async (data) => {
      try {
        await handler(data);
      } catch (error) {
        logger.error('Event handler failed', {
          event: eventName,
          error: error.message,
          stack: error.stack,
        });
      }
    });
    logger.info('Event handler registered', { event: eventName });
  }

  // One-time subscription
  subscribeOnce(eventName, handler) {
    this.once(eventName, async (data) => {
      try {
        await handler(data);
      } catch (error) {
        logger.error('One-time event handler failed', {
          event: eventName,
          error: error.message,
        });
      }
    });
  }

  // Unsubscribe handler
  unsubscribe(eventName, handler) {
    this.removeListener(eventName, handler);
    logger.info('Event handler removed', { event: eventName });
  }
}

module.exports = EventBus;
