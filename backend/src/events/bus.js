const EventEmitter = require('events');

class EventBus extends EventEmitter {
  /**
   * Emit an order lifecycle stage event.
   * @param {string} orderId
   * @param {'COMMITTED' | 'OUTBOX_PUBLISHED' | 'NOTIFIED' | 'INDEXED' | 'DUPLICATE_SKIPPED'} stage
   * @param {object} detail
   */
  emitStage(orderId, stage, detail = {}) {
    if (!orderId) return null;
    const payload = {
      stage,
      at: new Date().toISOString(),
      detail
    };
    this.emit(`order:${orderId}`, payload);
    this.emit('stage', { orderId, ...payload });
    return payload;
  }

  /**
   * Subscribe to stage events for a specific order.
   * Returns an unsubscribe function.
   */
  subscribeOrder(orderId, listener) {
    const eventKey = `order:${orderId}`;
    this.on(eventKey, listener);
    return () => this.off(eventKey, listener);
  }
}

const bus = new EventBus();

module.exports = bus;
