const { placeOrderAtomic } = require('../src/db');
const { startOutboxRelay, stopOutboxRelay } = require('../src/events/outboxRelay');
const { startNotificationsConsumer, stopNotificationsConsumer } = require('../src/events/notificationsConsumer');
const { getNotifications } = require('../src/db/repositories/consumerRepo');
const { producer } = require('../src/events/kafka');
const { pool } = require('../src/db/pool');
const { bus } = require('../src/events/bus');
const { randomUUID } = require('crypto');

const STORE_ID = '20000000-0000-4000-8000-000000000001'; // BLR-01
const PRODUCT_ID = '10000000-0000-4000-8000-000000000001'; // P01 boAt earphones
const CUSTOMER_ID = '30000000-0000-4000-8000-000000000001'; // Customer 1

async function runEndToEndVerification() {
  console.log('=== END-TO-END EVENT PIPELINE & EMAIL VERIFICATION ===\n');

  let orderId = null;

  try {
    // 1. Ensure stock
    await pool.query(
      'UPDATE inventory SET stock_qty = GREATEST(stock_qty, 5) WHERE store_id = $1 AND product_id = $2',
      [STORE_ID, PRODUCT_ID]
    );

    // 2. Connect Kafka producer & start consumers and relay
    console.log('[1] Connecting Kafka producer and starting Outbox Relay & Notifications Consumer...');
    await producer.connect();
    await startNotificationsConsumer({ fromBeginning: false });
    await startOutboxRelay();

    // 3. Track full order stage lifecycle via bus.js
    const stagesSeen = [];
    const orderPromise = new Promise((resolve) => {
      bus.on('stage', (payload) => {
        if (payload.orderId === orderId) {
          stagesSeen.push(payload.stage);
          console.log(`    [Order Lifecycle Stage]: ${payload.stage} at ${payload.at}`);
          if (payload.stage === 'NOTIFIED') {
            resolve();
          }
        }
      });
    });

    // 4. Trigger Atomic Checkout (Simulates User API call: POST /checkout)
    console.log('\n[2] Executing atomic checkout in PostgreSQL (placeOrderAtomic)...');
    const checkout = await placeOrderAtomic({
      customerId: CUSTOMER_ID,
      storeId: STORE_ID,
      items: [{ productId: PRODUCT_ID, quantity: 1 }],
      idempotencyKey: randomUUID()
    });

    orderId = checkout.order.id;
    console.log(`    Order created: id=${orderId}, orderNumber=${checkout.order.orderNumber}`);
    console.log(`    Total: ₹${(checkout.order.totalPaise / 100).toFixed(2)}`);

    // 5. Await pipeline processing through relay -> Kafka -> consumer -> Resend
    console.log('\n[3] Awaiting automatic pipeline propagation (Outbox -> Kafka -> Consumer -> Resend)...');
    const timeout = setTimeout(() => {
      console.warn('    Timed out waiting for NOTIFIED stage (12s). Checking DB state...');
    }, 12000);

    await Promise.race([orderPromise, new Promise((r) => setTimeout(r, 12000))]);
    clearTimeout(timeout);

    // 6. Verify Database outbox and notifications
    console.log('\n[4] Database State Assertions:');
    const outboxRes = await pool.query(
      'SELECT id, event_type, status, published_at FROM outbox_events WHERE aggregate_id = $1',
      [orderId]
    );
    console.log('    Outbox Events for Order:');
    for (const row of outboxRes.rows) {
      console.log(`    - ID ${row.id} (${row.event_type}): status=${row.status}, published_at=${row.published_at}`);
    }

    const notifs = await getNotifications(orderId);
    console.log(`    Notifications count in DB: ${notifs.length}`);
    if (notifs.length > 0) {
      console.log(`    Notification message: "${notifs[0].message}"`);
    }

    // 7. Verify Invariants
    const outboxPublished = outboxRes.rows.some((r) => r.event_type === 'OrderPlaced' && r.status === 'PUBLISHED');
    const notifSaved = notifs.length === 1;
    const notifiedStage = stagesSeen.includes('NOTIFIED');
    const relayStage = stagesSeen.includes('OUTBOX_PUBLISHED');

    console.log('\n[5] Pipeline Verifications:');
    console.log(`    - Outbox OrderPlaced marked PUBLISHED: ${outboxPublished ? 'PASS' : 'FAIL'}`);
    console.log(`    - OUTBOX_PUBLISHED stage emitted: ${relayStage ? 'PASS' : 'FAIL'}`);
    console.log(`    - Notification saved in DB: ${notifSaved ? 'PASS' : 'FAIL'}`);
    console.log(`    - NOTIFIED stage emitted: ${notifiedStage ? 'PASS' : 'FAIL'}`);

    if (outboxPublished && notifSaved && notifiedStage) {
      console.log('\n=== END-TO-END VERIFICATION RESULT: PASS ===');
    } else {
      console.log('\n=== END-TO-END VERIFICATION RESULT: FAIL ===');
    }

    // Cleanup
    await pool.query('DELETE FROM notifications WHERE order_id = $1', [orderId]);
    await pool.query('DELETE FROM outbox_events WHERE aggregate_id = $1', [orderId]);
    await pool.query('DELETE FROM orders WHERE id = $1', [orderId]);
    console.log('\nCleaned up test records.');

  } catch (err) {
    console.error('\n=== ERROR DURING END-TO-END RUN ===');
    console.error(err.message);
  } finally {
    await stopOutboxRelay();
    await stopNotificationsConsumer();
    try {
      await producer.disconnect();
    } catch (_) {}
    await pool.end();
  }
}

runEndToEndVerification();
