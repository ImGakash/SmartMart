/**
 * ============================================================================
 * TECH LEAD SSE WIRING HANDOFF
 * ============================================================================
 * 
 * Target Component: Audit / Timeline Consumer (Consumer Group: 'audit-timeline')
 * Subscribed Topics: 'order-events', 'inventory-events'
 * 
 * SSE ROUTE INTEGRATION GUIDE:
 * To expose live timeline stages via Server-Sent Events (SSE) (e.g. GET /orders/:id/events):
 * 
 * 1. Subscribe to order-specific bus events:
 *    const { bus } = require('./bus');
 *    
 *    app.get('/api/orders/:id/events', (req, res) => {
 *      const orderId = req.params.id;
 *      res.setHeader('Content-Type', 'text/event-stream');
 *      res.setHeader('Cache-Control', 'no-cache');
 *      res.setHeader('Connection', 'keep-alive');
 * 
 *      const listener = (data) => {
 *        // Event structure emitted:
 *        // {
 *        //   stage: 'COMMITTED' | 'OUTBOX_PUBLISHED' | 'KAFKA_EVENT_RECEIVED' | 'NOTIFIED' | 'INDEXED',
 *        //   at: '2026-11-21T11:45:00.000Z', (ISO 8601 string)
 *        //   detail: { ... } (detailed metadata below)
 *        // }
 *        res.write(`event: stage\ndata: ${JSON.stringify(data)}\n\n`);
 *      };
 * 
 *      bus.on(`order:${orderId}`, listener);
 *      req.on('close', () => bus.off(`order:${orderId}`, listener));
 *    });
 * 
 * 2. Exact 'KAFKA_EVENT_RECEIVED' Payload Shape:
 *    {
 *      orderId: '<uuid>',
 *      stage: 'KAFKA_EVENT_RECEIVED',
 *      at: '2026-11-21T11:45:00.000Z',
 *      detail: {
 *        eventType: 'OrderPlaced' | 'StoreStockChanged',
 *        eventId: '<uuid>',
 *        occurredAt: '<iso-timestamp>',
 *        aggregateId: '<uuid>',
 *        topic: 'order-events' | 'inventory-events',
 *        partition: 0,
 *        offset: '123'
 *      }
 *    }
 * ============================================================================
 */

const { createConsumer } = require('./kafka');
const { emitStage } = require('./bus');

let consumer = null;

/**
 * Audit / Timeline Consumer
 * Consumer group: 'audit-timeline'
 * Subscribes to BOTH 'order-events' and 'inventory-events'.
 */
async function startAuditConsumer() {
  consumer = createConsumer('audit-timeline');
  await consumer.connect();

  await consumer.subscribe({ topic: 'order-events', fromBeginning: true });
  await consumer.subscribe({ topic: 'inventory-events', fromBeginning: true });

  console.log('[AuditConsumer] Subscribed to order-events and inventory-events (group: audit-timeline)');

  await consumer.run({
    autoCommit: false,
    eachMessage: async ({ topic, partition, message }) => {
      let payload;
      try {
        payload = JSON.parse(message.value.toString());
      } catch (parseErr) {
        console.error(`[AuditConsumer] Malformed JSON encountered at offset ${message.offset}:`, parseErr.message);
        await consumer.commitOffsets([
          { topic, partition, offset: (BigInt(message.offset) + 1n).toString() }
        ]);
        return;
      }

      const {
        schemaVersion,
        eventId,
        eventType,
        occurredAt,
        orderId,
        productId
      } = payload;

      const aggregateId = message.key ? message.key.toString() : (orderId || productId);
      const targetOrderId = orderId || (eventType === 'OrderPlaced' ? aggregateId : null);

      // Emit KAFKA_EVENT_RECEIVED to bus with exact required metadata
      if (targetOrderId) {
        emitStage(targetOrderId, {
          stage: 'KAFKA_EVENT_RECEIVED',
          detail: {
            eventType,
            eventId,
            occurredAt,
            aggregateId,
            topic,
            partition,
            offset: message.offset
          }
        });
      }

      // Commit offset after processing
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
