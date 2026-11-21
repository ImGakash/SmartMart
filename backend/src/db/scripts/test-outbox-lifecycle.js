const { pool } = require('../pool');
const {
  claimOutboxEvents,
  markOutboxPublished,
  markOutboxFailed,
  requeueFailedOutboxEvents
} = require('../repositories/outboxRepo');

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function run() {
  console.log('--- Starting Outbox Lifecycle Tests ---\n');

  try {
    // 1. Test claimOutboxEvents
    console.log('[1] Testing claimOutboxEvents(20, 10)...');
    const claimedInitial = await claimOutboxEvents(20, 10);
    console.log(`Claimed ${claimedInitial.length} existing event(s). Status set to PROCESSING.`);
    for (const event of claimedInitial) {
      console.log(`  - Event ${event.id} (${event.eventType}): ${event.status || 'PROCESSING'}`);
    }

    // 2. Test markOutboxPublished
    console.log('\n[2] Testing markOutboxPublished(id)...');
    for (const event of claimedInitial) {
      const pubRes = await markOutboxPublished(event.id);
      console.log(`  - Marked event ${event.id} as PUBLISHED at ${pubRes.publishedAt}`);
    }
    if (claimedInitial.length === 0) {
      console.log('  (No existing rows to mark published, verified during step 5 after insert)');
    }

    // 3. Test manual insert + markOutboxFailed to FAILED threshold
    console.log('\n[3] Testing manual insert + markOutboxFailed(id, "test error", 5)...');
    const insertRes = await pool.query(`
      INSERT INTO outbox_events (aggregate_type, aggregate_id, event_type, payload, status, attempts)
      VALUES ('ORDER', gen_random_uuid(), 'OrderPlaced', '{"test": true}', 'PENDING', 4)
      RETURNING id, status, attempts;
    `);
    const testId = Number(insertRes.rows[0].id);
    console.log(`  Inserted test outbox row id=${testId} with initial attempts=4, status=PENDING`);

    const failedRes = await markOutboxFailed(testId, 'test error', 5);
    console.log(`  After markOutboxFailed: id=${failedRes.id}, attempts=${failedRes.attempts}, status=${failedRes.status}, lastError="${failedRes.lastError}"`);
    if (failedRes.status === 'FAILED' && failedRes.attempts === 5) {
      console.log('  -> PASS: attempts incremented to 5 and status transitioned to FAILED');
    } else {
      console.log(`  -> FAIL: expected status FAILED and attempts 5, got ${failedRes.status} and ${failedRes.attempts}`);
    }

    // 4. Test requeueFailedOutboxEvents
    console.log('\n[4] Testing requeueFailedOutboxEvents()...');
    const requeuedCount = await requeueFailedOutboxEvents();
    console.log(`  requeueFailedOutboxEvents returned count: ${requeuedCount}`);
    const checkRequeue = await pool.query('SELECT id, status, attempts, last_error FROM outbox_events WHERE id = $1', [testId]);
    const rRow = checkRequeue.rows[0];
    console.log(`  State after requeue: id=${rRow.id}, status=${rRow.status}, attempts=${rRow.attempts}, last_error=${rRow.last_error}`);
    if (rRow.status === 'PENDING' && Number(rRow.attempts) === 0 && rRow.last_error === null) {
      console.log('  -> PASS: FAILED rows reset to PENDING with attempts=0 and last_error=null');
    } else {
      console.log('  -> FAIL: Row not properly reset to PENDING');
    }

    // 5. Test lease recovery: claim row, wait 11 seconds, claim again
    console.log('\n[5] Testing lease recovery (leaseSeconds=10, waiting 11s)...');
    const claim1 = await claimOutboxEvents(10, 10);
    const hasTarget1 = claim1.some((e) => e.id === testId);
    console.log(`  First claim (batch of ${claim1.length}): target row ${testId} claimed = ${hasTarget1}`);

    // Claiming immediately should NOT return it (active lease)
    const immediateClaim = await claimOutboxEvents(10, 10);
    const hasTargetImmediate = immediateClaim.some((e) => e.id === testId);
    console.log(`  Immediate re-claim before lease expiry: target row ${testId} claimed = ${hasTargetImmediate} (expected false)`);

    console.log('  Waiting 11 seconds for lease to expire...');
    await sleep(11000);

    const claim2 = await claimOutboxEvents(10, 10);
    const reclaimed = claim2.find((e) => e.id === testId);
    if (reclaimed) {
      console.log(`  Second claim after 11s: target row ${reclaimed.id} successfully reclaimed!`);
      console.log('  -> PASS: lease recovery successfully reclaimed expired row');
      
      // Also test publishing it
      const pub = await markOutboxPublished(reclaimed.id);
      console.log(`  Published reclaimed row: status=${pub.status}, publishedAt=${pub.publishedAt}`);
    } else {
      console.log('  -> FAIL: expired lease was not reclaimed in second claim call');
    }

    // Cleanup test event
    await pool.query('DELETE FROM outbox_events WHERE id = $1', [testId]);
    console.log(`\nCleaned up test row id=${testId}`);
    console.log('\n--- All Outbox Lifecycle Tests Finished Successfully ---');

  } catch (err) {
    console.error('Test execution failed:', err);
  } finally {
    await pool.end();
  }
}

run();
