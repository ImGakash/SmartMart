const { pool, withTransaction } = require('../src/db/pool');
const { insertOutboxEvent } = require('../src/db/repositories/outboxRepo');
const { producer } = require('../src/events/kafka');
const { setChaosSwitch, getChaosState } = require('../src/events/chaos');
const { processOutboxBatch } = require('../src/events/outboxRelay');
const { startNotificationsConsumer, stopNotificationsConsumer } = require('../src/events/notificationsConsumer');
const { randomUUID } = require('crypto');

/**
 * STEP 10: RECOVERY TEST (TEST G / ACT 3)
 *
 * Invariant Verified:
 * 1. An order is created and outbox row inserted.
 * 2. 'relay-after-publish' chaos switch causes the relay to publish to Kafka but crash/exit before markOutboxPublished.
 * 3. Outbox row is left in 'PROCESSING' with published_at = null.
 * 4. Consumer receives message and executes transactional dedup (inserts 1 notification + 1 processed_events row).
 * 5. Time elapses or lease expires (claimed_at set into past) -> Relay reclaims the row.
 * 6. Relay publishes duplicate message to Kafka and this time successfully marks outbox row 'PUBLISHED'.
 * 7. Consumer receives the second/duplicate Kafka message.
 * 8. Consumer transactional deduplication catches the duplicate (markEventProcessed returns false).
 * 9. INVARIANT VERIFIED:
 *    - Outbox row status is 'PUBLISHED'.
 *    - processed_events has exactly 1 row for this eventId.
 *    - notifications table has exactly 1 notification for this orderId.
 *    - Zero duplicate side-effects occur.
 */
async function runRecoveryTest() {
  console.log('=== STEP 10: RECOVERY TEST (TEST G / ACT 3) ===\n');

  const testOrderId = randomUUID();
  let outboxRowId = null;
  let testEventId = null;

  try {
    // 0. Ensure clean slate for test customer & store
    console.log('[0] Preparing test environment & verifying database connectivity...');
    const storeRes = await pool.query('SELECT id FROM stores LIMIT 1');
    const custRes = await pool.query('SELECT id, name, email FROM customers LIMIT 1');
    const storeId = storeRes.rows[0].id;
    const customer = custRes.rows[0];

    // Ensure order exists so foreign key constraints in notifications table pass
    await pool.query(
      `INSERT INTO orders (id, customer_id, store_id, total_paise, status, source, idempotency_key)
       VALUES ($1, $2, $3, 259800, 'CONFIRMED', 'ONLINE', $4)`,
      [testOrderId, customer.id, storeId, randomUUID()]
    );
    console.log(`    Created base order record: ${testOrderId}`);

    // 1. Start Producer & Consumer
    console.log('\n[1] Starting Kafka Producer & Notifications Consumer (group: notifications)...');
    await producer.connect();
    await startNotificationsConsumer();

    // 2. Insert test OrderPlaced row into outbox_events
    console.log('\n[2] Inserting OrderPlaced event into outbox_events...');
    const outboxInsert = await insertOutboxEvent(null, {
      eventType: 'OrderPlaced',
      aggregateType: 'ORDER',
      aggregateId: testOrderId,
      payload: {
        orderId: testOrderId,
        orderNumber: 'SM-REC-001',
        source: 'ONLINE',
        storeId,
        customer: {
          id: customer.id,
          name: customer.name,
          email: 'delivered@resend.dev'
        },
        items: [
          {
            productId: '10000000-0000-4000-8000-000000000001',
            quantity: 2,
            unitPricePaise: 129900
          }
        ],
        totalPaise: 259800
      }
    });
    outboxRowId = outboxInsert.id;
    testEventId = outboxInsert.eventId;
    console.log(`    Outbox row inserted: id=${outboxRowId}, eventId=${testEventId}`);

    // 3. Arm chaos switch 'relay-after-publish' to simulate crash right after Kafka publish
    console.log('\n[3] Arming chaos switch "relay-after-publish" (one-shot)...');
    setChaosSwitch('relay-after-publish', true);

    // 4. Run first relay batch
    console.log('\n[4] Running first processOutboxBatch() with chaos armed...');
    await processOutboxBatch();

    // 5. Inspect database: outbox row MUST be PROCESSING with published_at = null
    const check1 = await pool.query(
      'SELECT id, status, attempts, claimed_at, published_at FROM outbox_events WHERE id = $1',
      [outboxRowId]
    );
    const row1 = check1.rows[0];
    console.log('    Outbox row after crash simulation:', row1);

    if (row1.status !== 'PROCESSING' || row1.published_at !== null) {
      throw new Error(`Crash simulation failed: status=${row1.status}, published_at=${row1.published_at}`);
    }
    console.log('    ✓ Outbox successfully simulated crash: row left in PROCESSING with null published_at.');

    // 6. Give notificationsConsumer a moment to process the first Kafka event
    console.log('\n[5] Waiting 5s for consumer to process first published event...');
    await new Promise(r => setTimeout(r, 5000));

    // Check processed_events & notifications
    const p1 = await pool.query('SELECT * FROM processed_events WHERE event_id = $1', [testEventId]);
    const n1 = await pool.query('SELECT * FROM notifications WHERE order_id = $1', [testOrderId]);
    console.log(`    After first delivery -> processed_events count: ${p1.rowCount}, notifications count: ${n1.rowCount}`);

    if (p1.rowCount !== 1 || n1.rowCount !== 1) {
      throw new Error(`Expected exactly 1 processed_event and 1 notification after first pass, got: pe=${p1.rowCount}, n=${n1.rowCount}`);
    }
    console.log('    ✓ First pass processed: 1 notification inserted, 1 processed_event recorded.');

    // 7. Simulate lease expiration by aging claimed_at by 60 seconds
    console.log('\n[6] Simulating lease expiration (aging claimed_at beyond lease interval)...');
    await pool.query(
      `UPDATE outbox_events
       SET claimed_at = now() - interval '60 seconds'
       WHERE id = $1`,
      [outboxRowId]
    );

    // 8. Run relay batch again (Recovery run)
    // Chaos switch was auto-cleared (one-shot), so relay will reclaim, re-publish, and mark PUBLISHED
    console.log('\n[7] Running second processOutboxBatch() (Recovery run)...');
    await processOutboxBatch();

    // 9. Inspect outbox state after recovery
    const check2 = await pool.query(
      'SELECT id, status, attempts, claimed_at, published_at FROM outbox_events WHERE id = $1',
      [outboxRowId]
    );
    const row2 = check2.rows[0];
    console.log('    Outbox row after recovery:', row2);

    if (row2.status !== 'PUBLISHED' || !row2.published_at) {
      throw new Error(`Recovery failed: expected status='PUBLISHED', got: status=${row2.status}, published_at=${row2.published_at}`);
    }
    console.log('    ✓ Outbox successfully recovered: status is PUBLISHED and published_at is populated.');

    // 10. Wait 5s for consumer to receive and process the second (duplicate) Kafka event
    console.log('\n[8] Waiting 5s for consumer to receive second/re-published event and deduplicate...');
    await new Promise(r => setTimeout(r, 5000));

    // 11. Verify EXACTLY ONCE semantics in database
    console.log('\n[9] Verifying Exactly-Once Semantics & Deduplication Invariants:');
    const p2 = await pool.query('SELECT * FROM processed_events WHERE event_id = $1', [testEventId]);
    const n2 = await pool.query('SELECT * FROM notifications WHERE order_id = $1', [testOrderId]);

    console.log(`    Final processed_events count for eventId ${testEventId}: ${p2.rowCount}`);
    console.log(`    Final notifications count for orderId ${testOrderId}: ${n2.rowCount}`);

    const pePass = p2.rowCount === 1;
    const notifPass = n2.rowCount === 1;
    const outboxPass = row2.status === 'PUBLISHED';

    console.log(`    - Outbox Status == PUBLISHED: ${outboxPass ? 'PASS' : 'FAIL'}`);
    console.log(`    - processed_events Count == 1: ${pePass ? 'PASS' : 'FAIL'}`);
    console.log(`    - notifications Count == 1 (No duplicate): ${notifPass ? 'PASS' : 'FAIL'}`);

    if (pePass && notifPass && outboxPass) {
      console.log('\n=== STEP 10 RESULT: PASS ===');
    } else {
      console.log('\n=== STEP 10 RESULT: FAIL ===');
      process.exitCode = 1;
    }

  } catch (err) {
    console.error('\n=== STEP 10 ERROR ===');
    console.error(err.message);
    process.exitCode = 1;
  } finally {
    // Cleanup test records
    console.log('\n[10] Cleaning up test records...');
    try {
      if (testEventId) {
        await pool.query('DELETE FROM processed_events WHERE event_id = $1', [testEventId]);
      }
      if (testOrderId) {
        await pool.query('DELETE FROM notifications WHERE order_id = $1', [testOrderId]);
        await pool.query('DELETE FROM orders WHERE id = $1', [testOrderId]);
      }
      if (outboxRowId) {
        await pool.query('DELETE FROM outbox_events WHERE id = $1', [outboxRowId]);
      }
      console.log('    Cleanup complete.');
    } catch (cleanErr) {
      console.warn('    Cleanup warning:', cleanErr.message);
    }

    try {
      await stopNotificationsConsumer();
      await producer.disconnect();
    } catch (_) {}
    await pool.end();
  }
}

runRecoveryTest();
