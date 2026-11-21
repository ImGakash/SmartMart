const { insertOutboxEvent } = require('../src/db/repositories/outboxRepo');
const { pool } = require('../src/db/pool');
const { producer, createConsumer } = require('../src/events/kafka');
const { bus } = require('../src/events/bus');
const { startOutboxRelay, stopOutboxRelay } = require('../src/events/outboxRelay');
const { randomUUID } = require('crypto');

async function runTest() {
  console.log('=== STEP 3: OUTBOX RELAY HAPPY PATH TEST ===\n');

  const testAggregateId = randomUUID();
  const testOrderId = randomUUID();
  const groupId = `relay-test-group-${Date.now()}`;
  const consumer = createConsumer(groupId);

  let insertedRowId = null;

  try {
    // 1. Connect Kafka Producer & Consumer
    console.log('[1] Connecting Kafka Producer and Consumer...');
    await producer.connect();
    await consumer.connect();
    await consumer.subscribe({ topic: 'order-events', fromBeginning: true });
    console.log('    Producer and Consumer connected. Subscribed to "order-events".');

    // 2. Set up listener to capture message from Kafka
    let consumedMessage = null;
    const kafkaPromise = new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error('Timed out waiting for Kafka message (15s)')), 15000);
      consumer.run({
        eachMessage: async ({ message }) => {
          if (message.key && message.key.toString() === testAggregateId) {
            clearTimeout(timer);
            consumedMessage = JSON.parse(message.value.toString());
            resolve(consumedMessage);
          }
        }
      });
    });

    // 3. Set up listener for bus.js OUTBOX_PUBLISHED event
    let busStageEmitted = false;
    bus.once(`order:${testAggregateId}`, (payload) => {
      if (payload.stage === 'OUTBOX_PUBLISHED') {
        busStageEmitted = true;
        console.log(`    [bus.js] Received stage: ${payload.stage} at ${payload.at}`);
      }
    });

    // 4. Insert mock PENDING outbox row
    console.log('\n[2] Inserting PENDING row into outbox_events...');
    const inserted = await insertOutboxEvent(null, {
      eventType: 'OrderPlaced',
      aggregateType: 'ORDER',
      aggregateId: testAggregateId,
      payload: {
        orderId: testOrderId,
        orderNumber: 'SM-RELAY-001',
        totalPaise: 129900
      }
    });
    insertedRowId = inserted.id;

    // Check DB BEFORE relay runs
    const beforeRes = await pool.query(
      'SELECT id, event_id, event_type, status, attempts, published_at FROM outbox_events WHERE id = $1',
      [insertedRowId]
    );
    console.log('    SQL BEFORE Relay:');
    console.log('   ', beforeRes.rows[0]);

    // 5. Start relay worker for one processing cycle
    console.log('\n[3] Starting Outbox Relay worker...');
    await startOutboxRelay();

    // 6. Await Kafka message publication
    console.log('    Awaiting Kafka delivery on "order-events"...');
    await kafkaPromise;

    // 7. Stop relay worker
    await stopOutboxRelay();

    // 8. Check DB AFTER relay runs
    console.log('\n[4] Checking SQL state AFTER Relay:');
    const afterRes = await pool.query(
      'SELECT id, event_id, event_type, status, attempts, published_at FROM outbox_events WHERE id = $1',
      [insertedRowId]
    );
    console.log('    SQL AFTER Relay:');
    console.log('   ', afterRes.rows[0]);

    // 9. Inspect received Kafka message envelope
    console.log('\n[5] Received Kafka Message Envelope:');
    console.log(JSON.stringify(consumedMessage, null, 2));

    // 10. Assertions
    const afterRow = afterRes.rows[0];
    const isStatusPublished = afterRow.status === 'PUBLISHED';
    const hasPublishedAt = afterRow.published_at !== null;
    const hasSchemaVersion = consumedMessage.schemaVersion === 1;
    const hasOccurredAt = typeof consumedMessage.occurredAt === 'string';
    const matchesEventId = consumedMessage.eventId === afterRow.event_id;

    console.log('\n[6] Contract Verification:');
    console.log(`    - Status changed to PUBLISHED: ${isStatusPublished ? 'PASS' : 'FAIL'}`);
    console.log(`    - published_at timestamp populated: ${hasPublishedAt ? 'PASS' : 'FAIL'}`);
    console.log(`    - Standard envelope schemaVersion=1: ${hasSchemaVersion ? 'PASS' : 'FAIL'}`);
    console.log(`    - Standard envelope occurredAt ISO string: ${hasOccurredAt ? 'PASS' : 'FAIL'}`);
    console.log(`    - Envelope eventId matches outbox event_id: ${matchesEventId ? 'PASS' : 'FAIL'}`);
    console.log(`    - bus.js OUTBOX_PUBLISHED stage emitted: ${busStageEmitted ? 'PASS' : 'FAIL'}`);

    if (isStatusPublished && hasPublishedAt && hasSchemaVersion && matchesEventId && busStageEmitted) {
      console.log('\n=== STEP 3 RESULT: PASS ===');
    } else {
      console.log('\n=== STEP 3 RESULT: FAIL ===');
    }

    // Cleanup
    if (insertedRowId) {
      await pool.query('DELETE FROM outbox_events WHERE id = $1', [insertedRowId]);
      console.log(`\nCleaned up test row id: ${insertedRowId}`);
    }

  } catch (err) {
    console.error('\n=== STEP 3 ERROR ===');
    console.error('Error detail:', err.message);
  } finally {
    try {
      await stopOutboxRelay();
      await producer.disconnect();
      await consumer.disconnect();
    } catch (_) {}
    await pool.end();
  }
}

runTest();
