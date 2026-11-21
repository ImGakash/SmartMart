const { producer } = require('../src/events/kafka');
const { startNotificationsConsumer, stopNotificationsConsumer } = require('../src/events/notificationsConsumer');
const { getNotifications } = require('../src/db/repositories/consumerRepo');
const { pool } = require('../src/db/pool');
const { bus } = require('../src/events/bus');
const { randomUUID } = require('crypto');

async function testNotificationConsumer() {
  console.log('=== STEP 5: NOTIFICATIONS CONSUMER DEDUP & TRANSACTION TEST ===\n');

  // 1. Guaranteed Clean Slate: generate a fresh valid UUID for this test run
  // Note: processed_events.event_id is typed as UUID in Postgres schema (CONTRACT §3).
  // A fresh randomUUID guarantees zero collisions / zero ghost duplicates.
  const eventId = randomUUID();
  console.log(`[0] Clean slate ensured. Fresh valid UUID eventId: ${eventId}`);

  let testOrderId;
  const testGroupId = `notifications-test-${Date.now()}`;

  try {
    // Setup real order to satisfy FK constraint on notifications.order_id
    console.log('[1] Setting up prerequisite order record...');
    const orderRes = await pool.query(`
      INSERT INTO orders (customer_id, store_id, source, total_paise, idempotency_key)
      VALUES (
        '30000000-0000-4000-8000-000000000001',
        '20000000-0000-4000-8000-000000000001',
        'ONLINE',
        259800,
        $1
      )
      RETURNING id, order_number;
    `, [randomUUID()]);
    testOrderId = orderRes.rows[0].id;
    const orderNumber = orderRes.rows[0].order_number;
    console.log(`    Order created: id=${testOrderId}, orderNumber=${orderNumber}`);

    // Connect producer and start consumer
    console.log('\n[2] Connecting Producer and starting Notifications Consumer...');
    await producer.connect();
    await startNotificationsConsumer({ groupId: testGroupId, fromBeginning: false });

    // Track event bus stages
    const stagesReceived = [];
    bus.on(`order:${testOrderId}`, (data) => {
      stagesReceived.push(data.stage);
      console.log(`    [bus.js] Stage dispatched for order: ${data.stage}`);
    });

    // 2. Resend Demo Address in envelope payload
    const envelope = {
      schemaVersion: 1,
      eventId,
      eventType: 'OrderPlaced',
      occurredAt: new Date().toISOString(),
      orderId: testOrderId,
      orderNumber,
      items: [{ productId: '10000000-0000-4000-8000-000000000001', quantity: 2, unitPricePaise: 129900 }],
      totalPaise: 259800,
      customer: {
        id: '30000000-0000-4000-8000-000000000001',
        name: 'Demo Customer',
        email: 'delivered+smartmart-demo@resend.dev'
      }
    };

    console.log(`\n[3] Publishing initial OrderPlaced event (eventId: ${eventId})...`);
    await producer.send({
      topic: 'order-events',
      messages: [{ key: testOrderId, value: JSON.stringify(envelope) }]
    });

    // Wait for consumer to process
    console.log('    Awaiting consumer processing (4s)...');
    await new Promise((r) => setTimeout(r, 4000));

    // Verify notification was inserted
    const notifs1 = await getNotifications(testOrderId);
    console.log(`    Notifications count after initial delivery: ${notifs1.length}`);
    if (notifs1.length !== 1) {
      throw new Error(`Expected 1 notification, got ${notifs1.length}`);
    }
    console.log(`    Notification message: "${notifs1[0].message}"`);

    // Verify processed_events row exists
    const dedupCheck1 = await pool.query(
      'SELECT event_id, consumer_group FROM processed_events WHERE event_id = $1',
      [eventId]
    );
    console.log(`    processed_events entry verified: ${dedupCheck1.rows.length === 1 ? 'YES' : 'NO'}`);

    // Send duplicate message with same eventId
    console.log(`\n[4] Publishing duplicate OrderPlaced event (same eventId: ${eventId})...`);
    await producer.send({
      topic: 'order-events',
      messages: [{ key: testOrderId, value: JSON.stringify(envelope) }]
    });

    console.log('    Awaiting duplicate consumer processing (4s)...');
    await new Promise((r) => setTimeout(r, 4000));

    // Verify notification count is STILL 1
    const notifs2 = await getNotifications(testOrderId);
    console.log(`    Notifications count after duplicate delivery: ${notifs2.length}`);

    // Verifications
    const notifCreated = notifs1.length === 1;
    const dedupAbsorbed = notifs2.length === 1;
    const notifiedStageEmitted = stagesReceived.includes('NOTIFIED');
    const duplicateSkippedEmitted = stagesReceived.includes('DUPLICATE_SKIPPED');

    console.log('\n[5] Contract & Dedup Assertions:');
    console.log(`    - First delivery created notification: ${notifCreated ? 'PASS' : 'FAIL'}`);
    console.log(`    - Second delivery absorbed (count still 1): ${dedupAbsorbed ? 'PASS' : 'FAIL'}`);
    console.log(`    - NOTIFIED stage emitted: ${notifiedStageEmitted ? 'PASS' : 'FAIL'}`);
    console.log(`    - DUPLICATE_SKIPPED stage emitted: ${duplicateSkippedEmitted ? 'PASS' : 'FAIL'}`);

    if (notifCreated && dedupAbsorbed && notifiedStageEmitted && duplicateSkippedEmitted) {
      console.log('\n=== STEP 5 RESULT: PASS ===');
    } else {
      console.log('\n=== STEP 5 RESULT: FAIL ===');
    }

    // Cleanup test data
    console.log('\n[6] Cleaning up test data...');
    await pool.query('DELETE FROM notifications WHERE order_id = $1', [testOrderId]);
    await pool.query('DELETE FROM processed_events WHERE event_id = $1', [eventId]);
    await pool.query('DELETE FROM orders WHERE id = $1', [testOrderId]);
    console.log('    Test data cleaned up.');

  } catch (err) {
    console.error('\n=== STEP 5 ERROR ===');
    console.error('Error detail:', err.message);
  } finally {
    await stopNotificationsConsumer();
    try {
      await producer.disconnect();
    } catch (_) {}
    await pool.end();
  }
}

testNotificationConsumer();
