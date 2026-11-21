const { pool, resetDemo, insertOutboxEvent, claimOutboxEvents, markOutboxPublished, markEventProcessed } = require('../../src/db');
const { randomUUID } = require('crypto');

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function runTestG() {
  console.log('=== TEST G: Relay Crash Recovery & Lease Reclaim ===');

  await resetDemo();

  // 1. Insert test outbox row
  const event = await insertOutboxEvent(null, {
    eventType: 'OrderPlaced',
    aggregateType: 'ORDER',
    aggregateId: randomUUID(),
    payload: { testCrashRecovery: true }
  });
  console.log(`- 1. Inserted outbox event id=${event.id}, eventId=${event.eventId}`);

  // 2. Claim row with 10s lease
  const claim1 = await claimOutboxEvents(10, 10);
  const claimedTarget = claim1.find((e) => e.id === event.id);
  console.log(`- 2. Claimed outbox row id=${claimedTarget ? claimedTarget.id : 'NONE'}`);

  // 3. Immediate re-claim should be blocked (active lease)
  const immediateClaim = await claimOutboxEvents(10, 10);
  const hasImmediate = immediateClaim.some((e) => e.id === event.id);
  console.log(`- 3. Immediate claim during active lease: ${hasImmediate} (expected false)`);

  // 4. Wait 11s for 10s lease to expire
  console.log('- 4. Waiting 11 seconds for lease to expire...');
  await sleep(11000);

  // 5. Reclaim after expiry
  const claim2 = await claimOutboxEvents(10, 10);
  const reclaimed = claim2.find((e) => e.id === event.id);
  console.log(`- 5. Re-claimed after lease expiry: id=${reclaimed ? reclaimed.id : 'NONE'}`);

  // 6. Mark published
  const pub = await markOutboxPublished(event.id);
  console.log(`- 6. Marked published: status=${pub.status}, publishedAt=${pub.publishedAt}`);

  // 7. Verify consumer dedup on replay
  const firstDelivery = await markEventProcessed(null, event.eventId, 'notifications');
  const secondDelivery = await markEventProcessed(null, event.eventId, 'notifications');
  console.log(`- 7. Consumer dedup on replay: first=${firstDelivery}, duplicate=${secondDelivery}`);

  const passed =
    claimedTarget !== undefined &&
    hasImmediate === false &&
    reclaimed !== undefined &&
    pub.status === 'PUBLISHED' &&
    firstDelivery === true &&
    secondDelivery === false;

  if (passed) {
    console.log('-> TEST G STATUS: PASS\n');
    return true;
  } else {
    console.error('-> TEST G STATUS: FAIL\n');
    return false;
  }
}

if (require.main === module) {
  runTestG()
    .then((pass) => {
      pool.end();
      process.exit(pass ? 0 : 1);
    })
    .catch((err) => {
      console.error(err);
      pool.end();
      process.exit(1);
    });
}

module.exports = { runTestG };
