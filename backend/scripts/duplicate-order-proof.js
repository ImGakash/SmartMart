const { producer } = require('../src/events/kafka');
const { startNotificationsConsumer, stopNotificationsConsumer } = require('../src/events/notificationsConsumer');
const { getNotifications } = require('../src/db/repositories/consumerRepo');
const { placeOrderAtomic } = require('../src/db'); // Assuming DB owner exports this
const { pool } = require('../src/db/pool');
const { bus } = require('../src/events/bus');
const { randomUUID } = require('crypto');

const STORE_ID = '20000000-0000-4000-8000-000000000001'; // BLR-01
const PRODUCT_ID = '10000000-0000-4000-8000-000000000002'; // P02 Galaxy Watch
const CUSTOMER_ID = '30000000-0000-4000-8000-000000000001'; // Customer 1

async function runDuplicateOrderProof() {
  console.log('=== STEP 6: DUPLICATE PROOF ON REAL ORDER ===\n');

  let realOrder = null;
  const eventId = randomUUID();
  const testGroupId = `notifications-test-dup-${Date.now()}`;

  try {
    // 1. Ensure stock exists for P02
    await pool.query(
      'UPDATE inventory SET stock_qty = GREATEST(stock_qty, 5) WHERE store_id = $1 AND product_id = $2',
      [STORE_ID, PRODUCT_ID]
    );

    // 2. Execute real order checkout via repository
    console.log('[1] Creating real order via placeOrderAtomic()...');
    const checkoutResult = await placeOrderAtomic({
      customerId: CUSTOMER_ID,
      storeId: STORE_ID,
      items: [{ productId: PRODUCT_ID, quantity: 1 }],
      idempotencyKey: randomUUID()
    });

    realOrder = checkoutResult.order;
    console.log(`    Real Order created successfully:`);
    console.log(`    - ID: ${realOrder.id}`);
    console.log(`    - Order Number: ${realOrder.orderNumber}`);
    console.log(`    - Total: ₹${(realOrder.totalPaise / 100).toFixed(2)}`);

    // 3. Connect Producer and start Notifications Consumer (with test-specific config)
    console.log('\n[2] Connecting Producer and starting Notifications Consumer...');
    await producer.connect();
    await startNotificationsConsumer({ groupId: testGroupId, fromBeginning: false });

    // 4. Track bus events
    const stagesSeen = [];
    bus.on(`order:${realOrder.id}`, (data) => {
      stagesSeen.push(data.stage);
      console.log(`    [bus.js] Order ${realOrder.id} received stage: ${data.stage}`);
    });

    // 5. Construct OrderPlaced event envelope with fixed eventId
    const envelope = {
      schemaVersion: 1,
      eventId,
      eventType: 'OrderPlaced',
      occurredAt: new Date().toISOString(),
      orderId: realOrder.id,
      orderNumber: realOrder.orderNumber,
      source: 'ONLINE',
      storeId: STORE_ID,
      customer: {
        id: CUSTOMER_ID,
        name: 'Customer 1',
        email: 'c01@demo.smartmart.in'
      },
      items: [
        {
          productId: PRODUCT_ID,
          quantity: 1,
          unitPricePaise: realOrder.items[0].unitPricePaise
        }
      ],
      totalPaise: realOrder.totalPaise
    };

    // 6. First publish
    console.log(`\n[3] Publishing eventId ${eventId} to order-events (First Delivery)...`);
    await producer.send({
      topic: 'order-events',
      messages: [{ key: realOrder.id, value: JSON.stringify(envelope) }]
    });

    console.log('    Awaiting initial consumption (4s)...');
    await new Promise((r) => setTimeout(r, 4000));

    // Verify first delivery: notification created
    const notifs1 = await getNotifications(realOrder.id);
    console.log(`    Notification count in DB after delivery 1: ${notifs1.length}`);
    if (notifs1.length !== 1) {
      throw new Error(`Expected exactly 1 notification after delivery 1, got ${notifs1.length}`);
    }
    console.log(`    Notification message: "${notifs1[0].message}"`);

    // 7. Second publish with SAME eventId (simulating Kafka redelivery or relay retry)
    console.log(`\n[4] Publishing eventId ${eventId} to order-events (Duplicate Redelivery)...`);
    await producer.send({
      topic: 'order-events',
      messages: [{ key: realOrder.id, value: JSON.stringify(envelope) }]
    });

    console.log('    Awaiting duplicate consumption (4s)...');
    await new Promise((r) => setTimeout(r, 4000));

    // Verify second delivery: count remains 1
    const notifs2 = await getNotifications(realOrder.id);
    console.log(`    Notification count in DB after duplicate delivery 2: ${notifs2.length}`);

    // Verify processed_events table entry
    const dedupRow = await pool.query(
      'SELECT event_id, consumer_group, processed_at FROM processed_events WHERE event_id = $1',
      [eventId]
    );

    console.log('\n[5] Database State Verifications:');
    console.log('    - processed_events record:', dedupRow.rows[0]);
    console.log('    - notifications records count:', notifs2.length);
    console.log('    - Bus stages recorded:', stagesSeen);

    const isCountOne = notifs2.length === 1;
    const hasProcessedRecord = dedupRow.rows.length === 1 && dedupRow.rows[0].consumer_group === 'notifications';
    const sawDuplicateSkipped = stagesSeen.includes('DUPLICATE_SKIPPED');

    console.log(`\n[6] Summary:`);
    console.log(`    - Exactly 1 notification persisted: ${isCountOne ? 'PASS' : 'FAIL'}`);
    console.log(`    - processed_events row recorded: ${hasProcessedRecord ? 'PASS' : 'FAIL'}`);
    console.log(`    - DUPLICATE_SKIPPED emitted on redelivery: ${sawDuplicateSkipped ? 'PASS' : 'FAIL'}`);

    if (isCountOne && hasProcessedRecord && sawDuplicateSkipped) {
      console.log('\n=== STEP 6 RESULT: PASS ===');
    } else {
      console.log('\n=== STEP 6 RESULT: FAIL ===');
    }

    // Cleanup created test notification & processed event
    await pool.query('DELETE FROM notifications WHERE order_id = $1', [realOrder.id]);
    await pool.query('DELETE FROM processed_events WHERE event_id = $1', [eventId]);
    console.log('\nCleaned up test notification and dedup record.');

  } catch (err) {
    console.error('\n=== STEP 6 ERROR ===');
    console.error(err.message);
  } finally {
    await stopNotificationsConsumer();
    try {
      await producer.disconnect();
    } catch (_) {}
    await pool.end();
  }
}

runDuplicateOrderProof();