const { createConsumer } = require('./kafka');
const { markEventProcessed, insertNotification } = require('../db/repositories/consumerRepo');
const { withTransaction } = require('../db/pool');
const { chaos } = require('./chaos');
const { emitStage } = require('./bus');
const { Resend } = require('resend');

// Initialize Resend only if API key is configured
const resend = process.env.RESEND_API_KEY ? new Resend(process.env.RESEND_API_KEY) : null;
const notifMode = process.env.NOTIFICATION_MODE || 'simulated';

let consumer = null;

async function startNotificationsConsumer(options = {}) {
  const groupId = options.groupId || 'notifications';
  const fromBeginning = options.fromBeginning !== undefined ? options.fromBeginning : true;

  consumer = createConsumer(groupId);
  await consumer.connect();
  await consumer.subscribe({ topic: 'order-events', fromBeginning });

  console.log(`[NotificationsConsumer] Subscribed to order-events (group: ${groupId}, fromBeginning: ${fromBeginning}, mode: ${notifMode})`);

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

      const { eventId, orderId, orderNumber, items = [], totalPaise = 0, customer } = payload;

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
            channel: notifMode === 'real' ? 'EMAIL' : 'SIMULATED_EMAIL',
            message: notifMessage
          });
        });

        if (wasFirstTime) {
          emitStage(orderId, {
            stage: 'NOTIFIED',
            detail: { eventId, orderNumber, totalPaise }
          });

          // 4. Send real email AFTER transaction commits (fail-soft)
          if (notifMode === 'real' && resend && customer?.email) {
            try {
              await resend.emails.send({
                from: process.env.NOTIFICATION_FROM_EMAIL || 'SmartMart <onboarding@resend.dev>',
                to: customer.email,
                subject: `Order ${orderNumber} Confirmed 🎉`,
                html: `
                  <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                    <h1 style="color: #2563eb;">Thank you for your order!</h1>
                    <p><strong>Order #${orderNumber}</strong></p>
                    <p>${items.length} item(s) — <strong>₹${formattedTotal}</strong></p>
                    <p>We'll notify you when it ships.</p>
                    <hr style="border: 1px solid #e5e7eb; margin: 20px 0;">
                    <p style="color: #6b7280; font-size: 12px;">
                      This email was sent automatically by SmartMart via Kafka event pipeline.
                    </p>
                  </div>
                `
              });
              console.log(`[NotificationsConsumer] 📧 Real email sent to ${customer.email} for order ${orderNumber}`);
            } catch (emailErr) {
              console.warn(`[NotificationsConsumer] Email send failed (non-fatal):`, emailErr.message);
            }
          } else if (notifMode === 'real' && !customer?.email) {
            console.warn(`[NotificationsConsumer] Real email mode enabled but no customer.email in payload. Skipping email.`);
          }
        }

        // 5. Commit offset strictly AFTER transaction commits
        await consumer.commitOffsets([{ topic, partition, offset: (BigInt(message.offset) + 1n).toString() }]);

      } catch (txErr) {
        console.error(`[NotificationsConsumer] Transaction failed for event ${eventId}:`, txErr.message);
        throw txErr;
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