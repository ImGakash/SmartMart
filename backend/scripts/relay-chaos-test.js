const { insertOutboxEvent } = require('../src/db/repositories/outboxRepo');
const { pool } = require('../src/db/pool');
const { producer } = require('../src/events/kafka');
const { setChaosSwitch, getChaosState } = require('../src/events/chaos');
const { processOutboxBatch } = require('../src/events/outboxRelay');
const { randomUUID } = require('crypto');

async function runChaosTest() {
  console.log('=== STEP 4: OUTBOX RELAY CHAOS & FAULT INJECTION TEST ===\n');

  let chaosOrderId = null;
  let testAggregateId = randomUUID();

  try {
    console.log('[1] Connecting Kafka Producer...');
    await producer.connect();
    console.log('    Producer connected.');

    // 1. Arm the chaos switch 'relay-after-publish'
    console.log('\n[2] Arming chaos switch "relay-after-publish"...');
    setChaosSwitch('relay-after-publish', true);
    console.log('    Switch state before relay run:', getChaosState()['relay-after-publish']);

    // 2. Insert test OrderPlaced row
    console.log('\n[3] Inserting test OrderPlaced outbox row...');
    const inserted = await insertOutboxEvent(null, {
      eventType: 'OrderPlaced',
      aggregateType: 'ORDER',
      aggregateId: testAggregateId,
      payload: {
        orderId: testAggregateId,
        orderNumber: 'SM-CHAOS-001',
        totalPaise: 129900
      }
    });
    chaosOrderId = inserted.id;

    // Check DB BEFORE relay runs
    const beforeRes = await pool.query(
      'SELECT id, event_id, status, attempts, published_at FROM outbox_events WHERE id = $1',
      [chaosOrderId]
    );
    console.log('    SQL BEFORE Relay:');
    console.log('   ', beforeRes.rows[0]);

    // 3. Run relay worker ONCE (deterministic, awaits completion)
    console.log('\n[4] Running processOutboxBatch() once...');
    await processOutboxBatch();

    // 4. Verify SQL state AFTER relay: row should remain PROCESSING and published_at is null
    console.log('\n[5] Checking SQL state AFTER Relay:');
    const afterRes = await pool.query(
      'SELECT id, event_id, status, attempts, claimed_at, published_at FROM outbox_events WHERE id = $1',
      [chaosOrderId]
    );
    const afterRow = afterRes.rows[0];
    console.log('    SQL AFTER Relay:');
    console.log('   ', afterRow);

    // 5. Verify chaos switch state: flag should have been cleared (one-shot)
    const flagAfter = getChaosState()['relay-after-publish'];
    console.log(`\n[6] Chaos switch "relay-after-publish" after run: ${flagAfter}`);

    const isProcessing = afterRow.status === 'PROCESSING';
    const noPublishedAt = afterRow.published_at === null;
    const flagCleared = flagAfter === false;

    console.log('\n[7] Verifications:');
    console.log(`    - Status remained PROCESSING: ${isProcessing ? 'PASS' : 'FAIL'}`);
    console.log(`    - published_at is NULL: ${noPublishedAt ? 'PASS' : 'FAIL'}`);
    console.log(`    - One-shot flag auto-cleared: ${flagCleared ? 'PASS' : 'FAIL'}`);

    if (isProcessing && noPublishedAt && flagCleared) {
      console.log('\n=== STEP 4 RESULT: PASS ===');
    } else {
      console.log('\n=== STEP 4 RESULT: FAIL ===');
    }

    // Cleanup
    if (chaosOrderId) {
      await pool.query('DELETE FROM outbox_events WHERE id = $1', [chaosOrderId]);
      console.log(`\nCleaned up test row id: ${chaosOrderId}`);
    }

  } catch (err) {
    console.error('\n=== STEP 4 ERROR ===');
    console.error(err.message);
  } finally {
    try {
      await producer.disconnect();
    } catch (_) {}
    await pool.end();
  }
}

runChaosTest();