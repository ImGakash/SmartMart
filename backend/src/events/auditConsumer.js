/**
 * ============================================================================
 * TECH LEAD HANDOFF: SSE ROUTE INTEGRATION
 * ============================================================================
 * 
 * Component: Audit / Timeline Consumer (Consumer Group: 'audit-timeline')
 * Subscribed Topics: 'order-events', 'inventory-events'
 * 
 * PURPOSE:
 * Bridges raw Kafka broker receipts directly to the internal EventBus (`bus.js`)
 * so the frontend Server-Sent Events (SSE) route (e.g., GET /orders/:id/events or
 * /api/xray/stream) can visualize the live order journey in real time.
 * 
 * SSE ROUTE USAGE:
 * ```javascript
 * const { bus } = require('../events/bus');
 * 
 * app.get('/api/orders/:id/events', (req, res) => {
 *   const orderId = req.params.id;
 *   res.setHeader('Content-Type', 'text/event-stream');
 *   res.setHeader('Cache-Control', 'no-cache');
 *   res.setHeader('Connection', 'keep-alive');
 * 
 *   // Listen for events specific to this order:
 *   const onOrderEvent = (eventData) => {
 *     res.write(`event: stage\ndata: ${JSON.stringify(eventData)}\n\n`);
 *   };
 * 
 *   bus.on(`order:${orderId}`, onOrderEvent);
 *   req.on('close', () => bus.off(`order:${orderId}`, onOrderEvent));
 * });
 * ```
 * 
 * EXACT EVENT STRUCTURE DISPATCHED:
 * {
 *   orderId: '<uuid>',
 *   stage: 'KAFKA_EVENT_RECEIVED',
 *   at: '<ISO-8601-timestamp>',
 *   detail: {
 *     eventType: 'OrderPlaced' | 'StoreStockChanged',
 *     eventId: '<uuid>',
 *     occurredAt: '<ISO-8601-timestamp>',
 *     aggregateId: '<uuid>',
 *     topic: 'order-events' | 'inventory-events',
 *     partition: 0,
 *     offset: '42'
 *   }
 * }
 * ============================================================================
 */

const { createConsumer } = require('./kafka');
const { emitStage } = require('./bus');

let consumer = null;

/**
 * Starts the Audit / Timeline Kafka Consumer.
 * Subscribes to both 'order-events' and 'inventory-events'.
 */
async function startAuditConsumer(options = {}) {
  const { groupId = 'audit-timeline', fromBeginning = false } = options;
  consumer = createConsumer(groupId);
  await consumer.connect();

  await consumer.subscribe({ topic: 'order-events', fromBeginning });
  await consumer.subscribe({ topic: 'inventory-events', fromBeginning });

  console.log(`[AuditConsumer] Subscribed to order-events and inventory-events (group: ${groupId})`);

  await consumer.run({
    autoCommit: false,
    eachMessage: async ({ topic, partition, message }) => {
      let payload;
      try {
        payload = JSON.parse(message.value.toString());
      } catch (parseErr) {
        console.error(`[AuditConsumer] Poison pill / invalid JSON at offset ${message.offset} on ${topic}:`, parseErr.message);
        await consumer.commitOffsets([
          { topic, partition, offset: (BigInt(message.offset) + 1n).toString() }
        ]);
        return;
      }

      const { eventId, eventType, occurredAt, orderId, productId } = payload;

      if (!eventId) {
        console.warn(`[AuditConsumer] Skipping message missing eventId at offset ${message.offset} on ${topic}`);
        await consumer.commitOffsets([
          { topic, partition, offset: (BigInt(message.offset) + 1n).toString() }
        ]);
        return;
      }

      const aggregateId = message.key ? message.key.toString() : (orderId || productId || eventId);
      const targetOrderId = orderId || (eventType === 'OrderPlaced' ? aggregateId : null);

      // Emit exact required payload to bus.js
      if (targetOrderId) {
        emitStage(targetOrderId, {
          stage: 'KAFKA_EVENT_RECEIVED',
          detail: {
            eventType,
            eventId,
            occurredAt: occurredAt || new Date().toISOString(),
            aggregateId,
            topic,
            partition,
            offset: message.offset
          }
        });
      }

      // Commit offset strictly AFTER emitting to the bus
      await consumer.commitOffsets([
        {
          topic,
          partition,
          offset: (BigInt(message.offset) + 1n).toString()
        }
      ]);
    }
  });
}

/**
 * Stops the Audit Consumer.
 */
async function stopAuditConsumer() {
  if (consumer) {
    await consumer.disconnect();
    consumer = null;
    console.log('[AuditConsumer] Disconnected');
  }
}

module.exports = {
  startAuditConsumer,
  stopAuditConsumer
};
