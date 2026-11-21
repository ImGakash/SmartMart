const config = require('../config');
const db = require('../db');
const { getProducer, TOPICS } = require('./kafka');
const bus = require('./bus');
const { getChaosState, setChaosSwitch } = require('./chaos');

let running = false;
let loopPromise = null;
let sleepTimeout = null;

function sleep(ms) {
  return new Promise((resolve) => {
    sleepTimeout = setTimeout(resolve, ms);
  });
}

async function runRelayLoop() {
  const batchSize = config.outboxBatchSize || 20;
  const leaseSeconds = config.outboxLeaseSeconds || 10;
  const pollMs = config.outboxPollMs || 1000;
  const maxAttempts = config.outboxMaxAttempts || 5;

  console.log(`Outbox relay started (batchSize: ${batchSize}, leaseSeconds: ${leaseSeconds}s, poll: ${pollMs}ms)`);

  while (running) {
    try {
      const chaos = getChaosState();

      // Chaos: 'relay' pauses the entire loop
      if (chaos.relay) {
        await sleep(pollMs);
        continue;
      }

      // Claim outbox events (short DB transaction committed inside repo function)
      const rows = await db.claimOutboxEvents(batchSize, leaseSeconds);

      if (!rows || rows.length === 0) {
        // Idle: sleep before next poll
        await sleep(pollMs);
        continue;
      }

      const producer = getProducer();

      for (const row of rows) {
        if (!running) break;

        const topic = TOPICS[row.eventType];
        if (!topic) {
          console.error(`Unknown eventType: ${row.eventType} for outbox event ${row.id}`);
          await db.markOutboxFailed(row.id, `Unknown eventType: ${row.eventType}`, maxAttempts);
          continue;
        }

        const occurredAt = row.createdAt instanceof Date
          ? row.createdAt.toISOString()
          : new Date(row.createdAt).toISOString();

        const envelope = {
          schemaVersion: 1,
          eventId: row.eventId,
          eventType: row.eventType,
          occurredAt,
          ...row.payload
        };

        const key = String(row.aggregateId);
        const value = JSON.stringify(envelope);

        try {
          // Publish to Kafka and await broker ack
          await producer.send({
            topic,
            messages: [{ key, value }]
          });

          // Check chaos: 'relay-after-publish' (one-shot on next OrderPlaced event)
          const currentChaos = getChaosState();
          if (row.eventType === 'OrderPlaced' && currentChaos['relay-after-publish']) {
            console.log(
              `[CHAOS: relay-after-publish] OrderPlaced ${row.eventId} published to Kafka; SKIPPING markOutboxPublished. Row remains PROCESSING.`
            );
            setChaosSwitch('relay-after-publish', false);
            // DO NOT call markOutboxPublished! Leave row PROCESSING.
            // Relay keeps running to reclaim it after lease expiry.
            continue;
          }

          // Normal success path
          await db.markOutboxPublished(row.id);

          // Emit bus stage OUTBOX_PUBLISHED
          const orderId = row.payload?.orderId || (row.eventType === 'OrderPlaced' ? row.aggregateId : null);
          if (orderId) {
            bus.emitStage(orderId, 'OUTBOX_PUBLISHED', {
              eventId: row.eventId,
              eventType: row.eventType
            });
          }
        } catch (publishErr) {
          console.error(`Failed to publish outbox event ${row.id} (${row.eventType}):`, publishErr.message);
          await db.markOutboxFailed(row.id, publishErr.message, maxAttempts);
        }
      }

      // If batch was full, immediately poll next batch without sleeping
      if (rows.length < batchSize) {
        await sleep(pollMs);
      }
    } catch (loopErr) {
      console.error('Error in outbox relay loop:', loopErr.message);
      await sleep(pollMs);
    }
  }

  console.log('Outbox relay loop stopped.');
}

function start() {
  if (running) return;
  running = true;
  loopPromise = runRelayLoop();
}

async function stop() {
  running = false;
  if (sleepTimeout) {
    clearTimeout(sleepTimeout);
    sleepTimeout = null;
  }
  if (loopPromise) {
    await loopPromise;
    loopPromise = null;
  }
}

module.exports = {
  start,
  stop
};
