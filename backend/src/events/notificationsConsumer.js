const { createConsumer } = require('./kafka');
const { markEventProcessed, insertNotification } = require('../db/repositories/consumerRepo');
const { withTransaction } = require('../db/pool');
const { chaos } = require('./chaos');
const { emitStage } = require('./bus');

let consumer = null;

async function startNotificationsConsumer(options = {}) {
  const groupId = options.groupId || 'notifications';
  const fromBeginning = options.fromBeginning !== undefined ? options.fromBeginning : true;

  consumer = createConsumer(groupId);
  await consumer.connect();
  await consumer.subscribe({ topic: 'order-events', fromBeginning });

  console.log(`[NotificationsConsumer] Subscribed to order-events (group: ${groupId}, fromBeginning: ${fromBeginning})`);

  await consumer.run({
    autoCommit: false,
    eachMessage: async ({ topic, partition, message }) => {
      // 1. Chaos switch check: pause processing if switch is active
      while (chaos.notifications) {
        await new Promise((resolve) => setTimeout(resolve, 500));
      }

      // 2. Safe JSON parsing / Poison message protection
      let payload;
      try {
        payload = JSON.parse(message.value.toString());
      } catch (parseErr) {
        console.error(`[NotificationsConsumer] Poison pill encountered at offset ${message.offset}. Malformed JSON:`, parseErr.message);
        await consumer.commitOffsets([{ topic, partition, offset: (BigInt(message.offset) + 1n).toString() }]);
        return;
      }

      const { eventId, orderId, orderNumber, items = [], totalPaise = 0 } = payload;

      if (!eventId || !orderId) {
        console.warn(`[NotificationsConsumer] Skipping message without eventId or orderId at offset ${message.offset}`);
        await consumer.commitOffsets([{ topic, partition, offset: (BigInt(message.offset) + 1n).toString() }]);
        return;
      }

      const formattedTotal = (Number(totalPaise) / 100).toFixed(2);
      const notifMessage = `Order ${orderNumber} confirmed: ${items.length} item(s), ₹${formattedTotal}. Thank you for shopping with SmartMart!`;

      // 3. Single atomic withTransaction: dedup check + notification insertion
      let wasFirstTime = false;
      try {
        await withTransaction(async (tx) => {
          wasFirstTime = await markEventProcessed(tx, eventId, 'notifications');
          if (!wasFirstTime) {
            console.log(`[NotificationsConsumer] Duplicate event ${eventId} absorbed by processed_events`);
            emitStage(orderId, { stage: 'DUPLICATE_SKIPPED', detail: { eventId } });
            return;
          }
          await insertNotification(tx, {
            orderId,
            channel: 'SIMULATED_EMAIL',
            message: notifMessage
          });
        });

        if (wasFirstTime) {
          emitStage(orderId, {
            stage: 'NOTIFIED',
            detail: { eventId, orderNumber, totalPaise }
          });
        }

        // 4. Commit offset strictly AFTER transaction commits
        await consumer.commitOffsets([{ topic, partition, offset: (BigInt(message.offset) + 1n).toString() }]);

      } catch (txErr) {
        console.error(`[NotificationsConsumer] Transaction failed for event ${eventId}:`, txErr.message);
        throw txErr; // Do NOT commit offset so Kafka redelivers
      }
    }
  });
}

async function stopNotificationsConsumer() {
  if (consumer) {
    await consumer.disconnect();
    consumer = null;
    console.log('[NotificationsConsumer] Disconnected');
  }
}

module.exports = {
  startNotificationsConsumer,
  stopNotificationsConsumer
};