const EventEmitter = require('events');

class EventBus extends EventEmitter {
  constructor() {
    super();
    this.setMaxListeners(100);
  }

  emitStage(orderId, { stage, detail = {} } = {}) {
    const payload = {
      orderId,
      stage,
      at: new Date().toISOString(),
      detail
    };

    if (orderId) {
      this.emit(`order:${orderId}`, payload);
    }
    this.emit('stage', payload);
    return payload;
  }
}

const bus = new EventBus();

module.exports = {
  bus,
  emitStage: (orderId, options) => bus.emitStage(orderId, options)
};