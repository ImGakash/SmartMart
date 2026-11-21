const { claimOutboxEvents, markOutboxPublished, markOutboxFailed } = require('../db/repositories/outboxRepo');
const { producer } = require('./kafka');
const { chaos, consumeOneShotRelayAfterPublish } = require('./chaos');
const { emitStage } = require('./bus');
const config = require('../config');

let isRunning = false;
let relayTimeout = null;

async function processOutboxBatch() {
  // Check chaos switch: pause relay loop if flag is set (§7)
  if (chaos.relay) {
    if (isRunning) {
      relayTimeout = setTimeout(processOutboxBatch, config.outbox.pollMs);
    }
    return [];
  }

  let events = [];
  try {
    events = await claimOutboxEvents(config.outbox.batchSize, config.outbox.leaseSeconds);
  } catch (err) {
    console.error('[OutboxRelay] Error claiming outbox events:', err.message);
    if (isRunning) {
      relayTimeout = setTimeout(processOutboxBatch, config.outbox.pollMs);
    }
    return [];
  }

  for (const event of events) {
    const topic = event.eventType === 'OrderPlaced' ? 'order-events' : 'inventory-events';
    const envelope = {
      schemaVersion: 1,
      eventId: event.eventId,
      eventType: event.eventType,
      occurredAt: event.createdAt,
      ...event.payload
    };

    try {
      // Publish to Kafka: key = aggregateId (§6)
      await producer.send({
        topic,
        messages: [
          {
            key: String(event.aggregateId),
            value: JSON.stringify(envelope)
          }
        ],
        timeout: config.kafka.publishTimeoutMs
      });

      // One-shot fault injection: relay-after-publish (§7)
      if (consumeOneShotRelayAfterPublish(event.eventType)) {
        console.warn(`[OutboxRelay] CHAOS 'relay-after-publish' TRIGGERED for event ${event.id}. Skipping markOutboxPublished.`);
        // Per contract: leave row PROCESSING, flag cleared, relay keeps running
        continue;
      }

      // Happy path: mark as PUBLISHED
      await markOutboxPublished(event.id);

      // Emit stage to event bus
      if (event.eventType === 'OrderPlaced') {
        emitStage(event.aggregateId, { stage: 'OUTBOX_PUBLISHED', detail: { eventId: event.eventId } });
      }

    } catch (pubErr) {
      console.error(`[OutboxRelay] Publish failed for event ${event.id}:`, pubErr.message);
      await markOutboxFailed(event.id, pubErr.message, config.outbox.maxAttempts || 5);
    }
  }

  // Poll interval: 1000ms when idle; immediate next poll on full batch (only if loop is running)
  if (isRunning) {
    const delay = events.length === config.outbox.batchSize ? 0 : config.outbox.pollMs;
    relayTimeout = setTimeout(processOutboxBatch, delay);
  }

  return events;
}

async function startOutboxRelay() {
  if (isRunning) return;
  isRunning = true;
  console.log('[OutboxRelay] Starting outbox relay loop...');
  processOutboxBatch();
}

async function stopOutboxRelay() {
  isRunning = false;
  if (relayTimeout) {
    clearTimeout(relayTimeout);
    relayTimeout = null;
  }
  console.log('[OutboxRelay] Stopped outbox relay.');
}

module.exports = {
  startOutboxRelay,
  stopOutboxRelay,
  processOutboxBatch
};