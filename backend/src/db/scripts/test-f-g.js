const { pool, withTransaction } = require('../pool');
const { markEventProcessed, insertNotification, getNotifications } = require('../repositories/consumerRepo');
const {
  claimOutboxEvents,
  markOutboxPublished,
  insertOutboxEvent
} = require('../repositories/outboxRepo');
const { randomUUID } = require('crypto');

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function runTests() {
  console.log('==============================================');
  console.log('   RUNNING TEST F & TEST G VERIFICATION       ');
  console.log('==============================================\n');

  try {
    // -------------------------------------------------------------
    // TEST F: Notification Dedup
    // -------------------------------------------------------------
    console.log('--- TEST F: Notification Dedup ---');

    // Create a real order to satisfy FK constraint for notification
    const orderRes = await pool.query(`
      INSERT INTO orders (customer_id, store_id, source, total_paise, idempotency_key)
      VALUES (
        '30000000-0000-4000-8000-000000000001',
        '20000000-0000-4000-8000-000000000001',
        'ONLINE',
        129900,
        $1
      )
      RETURNING id;
    `, [randomUUID()]);
    const testOrderId = orderRes.rows[0].id;

    const testEventId = randomUUID();
    const consumerGroup = 'notifications';

    console.log(`Test Event ID: ${testEventId}`);
    console.log(`Consumer Group: ${consumerGroup}`);
    console.log(`Test Order ID: ${testOrderId}`);

    // Call 1: markEventProcessed
    const firstCall = await markEventProcessed(null, testEventId, consumerGroup);
    console.log(`1. First markEventProcessed call return value: ${firstCall}`);

    // Insert notification record
    const notif1 = await insertNotification(null, {
      orderId: testOrderId,
      channel: 'SIMULATED_EMAIL',
      message: 'Order confirmed: 1 item(s). Thank you!'
    });
    console.log(`2. First notification insert result:`, notif1 ? `Created (id: ${notif1.id})` : 'Skipped');

    // Call 2: markEventProcessed with same event ID
    const secondCall = await markEventProcessed(null, testEventId, consumerGroup);
    console.log(`3. Second markEventProcessed call return value: ${secondCall}`);

    // Attempt second notification insert (duplicate)
    const notif2 = await insertNotification(null, {
      orderId: testOrderId,
      channel: 'SIMULATED_EMAIL',
      message: 'Order confirmed duplicate attempt!'
    });
    console.log(`4. Second notification insert result (UNIQUE constraint on order_id, channel):`, notif2 === null ? 'null (duplicate prevented)' : notif2);

    // Verify row count in notifications for this order
    const notifs = await getNotifications(testOrderId);
    console.log(`5. Total notifications in DB for order ${testOrderId}: ${notifs.length}`);

    if (firstCall === true && secondCall === false && notifs.length === 1) {
      console.log('-> TEST F STATUS: PASS (Dedup absorbed duplicate; exactly 1 notification stored)\n');
    } else {
      console.log('-> TEST F STATUS: FAIL\n');
    }

    // -------------------------------------------------------------
    // TEST G: Relay Crash Recovery
    // -------------------------------------------------------------
    console.log('--- TEST G: Relay Crash Recovery ---');

    // 1. Insert test outbox row with status PENDING
    const outboxRow = await insertOutboxEvent(null, {
      eventType: 'OrderPlaced',
      aggregateType: 'ORDER',
      aggregateId: testOrderId,
      payload: { testCrashRecovery: true }
    });
    console.log(`1. Inserted test outbox row: id=${outboxRow.id}, eventId=${outboxRow.eventId}, status=PENDING`);

    // 2. Claim the row with 10-second lease
    const firstClaim = await claimOutboxEvents(10, 10);
    const claimedRow = firstClaim.find((e) => e.id === outboxRow.id);
    console.log(`2. Claimed outbox row id=${claimedRow ? claimedRow.id : 'NONE'}. Status set to PROCESSING.`);

    // 3. Simulate relay crash by NOT calling markOutboxPublished
    console.log('3. Simulating relay crash: NOT calling markOutboxPublished.');

    // Verify row is in PROCESSING status and cannot be claimed immediately
    const immediateClaim = await claimOutboxEvents(10, 10);
    const inImmediate = immediateClaim.some((e) => e.id === outboxRow.id);
    console.log(`   Immediate claim during active lease: row claimed = ${inImmediate} (expected false)`);

    // 4. Wait 11 seconds for lease to expire
    console.log('4. Waiting 11 seconds for the 10-second lease to expire...');
    await sleep(11000);

    // 5. Claim again - lease recovery should return the row
    const secondClaim = await claimOutboxEvents(10, 10);
    const reclaimedRow = secondClaim.find((e) => e.id === outboxRow.id);
    console.log(`5. Re-claimed outbox row after lease expiry: id=${reclaimedRow ? reclaimedRow.id : 'NONE'}`);

    if (!reclaimedRow) {
      console.log('-> TEST G STATUS: FAIL (Row was not reclaimed after lease expiry)');
      return;
    }

    // 6. Call markOutboxPublished on the reclaimed row
    const publishRes = await markOutboxPublished(reclaimedRow.id);
    console.log(`6. Called markOutboxPublished: status=${publishRes.status}, publishedAt=${publishRes.publishedAt}`);

    // 7. Verify dedup mechanism in consumer would absorb duplicate if published twice
    const consumerDedupCheck = await markEventProcessed(null, outboxRow.eventId, 'notifications');
    console.log(`7. Consumer dedup for reclaimed event ${outboxRow.eventId}: first delivery = ${consumerDedupCheck}`);
    const consumerDedupDuplicate = await markEventProcessed(null, outboxRow.eventId, 'notifications');
    console.log(`   Consumer dedup for redelivered event ${outboxRow.eventId}: redelivery = ${consumerDedupDuplicate}`);

    if (reclaimedRow && publishRes.status === 'PUBLISHED' && consumerDedupCheck === true && consumerDedupDuplicate === false) {
      console.log('-> TEST G STATUS: PASS (Lease recovery succeeded, published successfully, consumer dedup verified)\n');
    } else {
      console.log('-> TEST G STATUS: FAIL\n');
    }

    // Cleanup test data
    await pool.query('DELETE FROM notifications WHERE order_id = $1', [testOrderId]);
    await pool.query('DELETE FROM outbox_events WHERE id = $1', [outboxRow.id]);
    await pool.query('DELETE FROM processed_events WHERE event_id IN ($1, $2)', [testEventId, outboxRow.eventId]);
    await pool.query('DELETE FROM orders WHERE id = $1', [testOrderId]);
    console.log('Cleaned up test data.');

  } catch (err) {
    console.error('Error during test execution:', err);
  } finally {
    await pool.end();
  }
}

runTests();
