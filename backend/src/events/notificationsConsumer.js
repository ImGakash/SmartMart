const db = require('../db');
const { createConsumer, TOPICS } = require('./kafka');
const bus = require('./bus');
const { getChaosState } = require('./chaos');

let consumer = null;
let running = false;
let sleepTimeout = null;

function sleep(ms) {
  return new Promise((resolve) => {
    sleepTimeout = setTimeout(resolve, ms);
  });
}

async function start() {
  if (running) return;
  running = true;

  consumer = createConsumer('notifications');
  await consumer.connect();
  await consumer.subscribe({ topic: TOPICS.OrderPlaced, fromBeginning: true });

  await consumer.run({
    autoCommit: false,
    eachMessage: async ({ topic, partition, message, heartbeat }) => {
      // 1. Check chaos switch: pause processing if chaos switch 'notifications' is true
      while (running && getChaosState().notifications) {
        await heartbeat();
        await sleep(1000);
      }
      if (!running) return;

      let envelope;
      try {
        envelope = JSON.parse(message.value.toString('utf-8'));
      } catch (parseErr) {
        console.error('Failed to parse envelope in notifications consumer:', parseErr.message);
        await consumer.commitOffsets([
          { topic, partition, offset: (BigInt(message.offset) + 1n).toString() }
        ]);
        return;
      }

      if (envelope.eventType !== 'OrderPlaced') {
        await consumer.commitOffsets([
          { topic, partition, offset: (BigInt(message.offset) + 1n).toString() }
        ]);
        return;
      }

      const { eventId, orderId, orderNumber, items, totalPaise } = envelope;

      // Message template EXACTLY per CONTRACT.md §8:
      // `Order ${orderNumber} confirmed: ${items.length} item(s), ₹${(totalPaise/100).toFixed(2)}. Thank you for shopping with SmartMart!`
      const itemCount = Array.isArray(items) ? items.length : 0;
      const formattedTotal = ((Number(totalPaise) || 0) / 100).toFixed(2);
      const messageText = `Order ${orderNumber} confirmed: ${itemCount} item(s), ₹${formattedTotal}. Thank you for shopping with SmartMart!`;

      let isFirst = false;
      try {
        await db.withTransaction(async (tx) => {
          const first = await db.markEventProcessed(tx, eventId, 'notifications');
          if (!first) {
            bus.emitStage(orderId, 'DUPLICATE_SKIPPED', {
              eventId,
              consumerGroup: 'notifications'
            });
            return;
          }
          isFirst = true;
          await db.insertNotification(tx, {
            orderId,
            channel: 'SIMULATED_EMAIL',
            message: messageText
          });
        });
      } catch (dbErr) {
        if (dbErr.code === '23503') {
          console.warn(`[notificationsConsumer] Order ${orderId} not found in orders table (FK 23503). Skipping orphaned event.`);
          await consumer.commitOffsets([
            { topic, partition, offset: (BigInt(message.offset) + 1n).toString() }
          ]);
          return;
        }
        throw dbErr;
      }

      if (isFirst) {
        // On success emit bus stage NOTIFIED (detail { orderId })
        bus.emitStage(orderId, 'NOTIFIED', { orderId });
      }

      // COMMIT KAFKA OFFSET (offset + 1) ONLY AFTER the PG transaction resolves
      await consumer.commitOffsets([
        { topic, partition, offset: (BigInt(message.offset) + 1n).toString() }
      ]);
    }
  });

  console.log(`Notifications consumer started (group: 'notifications', topic: '${TOPICS.OrderPlaced}')`);
}

async function stop() {
  running = false;
  if (sleepTimeout) {
    clearTimeout(sleepTimeout);
    sleepTimeout = null;
  }
  if (consumer) {
    try {
      await consumer.stop();
      await consumer.disconnect();
    } catch (e) {
      console.warn('Error stopping notifications consumer:', e.message);
    }
    consumer = null;
  }
}

module.exports = {
  start,
  stop
};
