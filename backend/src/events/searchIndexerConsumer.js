const db = require('../db');
const { createConsumer, TOPICS } = require('./kafka');
const bus = require('./bus');
const { getChaosState } = require('./chaos');
const search = require('../search/productIndex');

let consumer = null;
let running = false;
let sleepTimeout = null;

function sleep(ms) {
  return new Promise((resolve) => {
    sleepTimeout = setTimeout(resolve, ms);
  });
}

async function start() {
  if (running) return;
  running = true;

  consumer = createConsumer('search-indexer');
  await consumer.connect();
  await consumer.subscribe({ topic: TOPICS.StoreStockChanged, fromBeginning: true });

  await consumer.run({
    autoCommit: false,
    eachMessage: async ({ topic, partition, message, heartbeat }) => {
      // 1. Check chaos switch: pause processing if chaos switch 'search-indexer' is true
      while (running && getChaosState()['search-indexer']) {
        await heartbeat();
        await sleep(1000);
      }
      if (!running) return;

      let envelope;
      try {
        envelope = JSON.parse(message.value.toString('utf-8'));
      } catch (parseErr) {
        console.error('Failed to parse envelope in search-indexer consumer:', parseErr.message);
        await consumer.commitOffsets([
          { topic, partition, offset: (BigInt(message.offset) + 1n).toString() }
        ]);
        return;
      }

      if (envelope.eventType !== 'StoreStockChanged') {
        await consumer.commitOffsets([
          { topic, partition, offset: (BigInt(message.offset) + 1n).toString() }
        ]);
        return;
      }

      const { productId, orderId } = envelope;

      // RE-READ authoritative state: db.getProductSearchDoc(payload.productId)
      // (NEVER index stock numbers from the event payload)
      let doc;
      try {
        doc = await db.getProductSearchDoc(productId);
      } catch (err) {
        if (err.code === 'PRODUCT_NOT_FOUND' || (err.message && err.message.includes('PRODUCT_NOT_FOUND'))) {
          console.warn(`[searchIndexerConsumer] Product ${productId} not found. Skipping orphaned event.`);
          await consumer.commitOffsets([
            { topic, partition, offset: (BigInt(message.offset) + 1n).toString() }
          ]);
          return;
        }
        throw err;
      }

      // search.upsertProduct(doc) with _id=productId, refresh:'wait_for'
      await search.upsertProduct(doc);

      // Emit bus stage INDEXED for payload.orderId, detail: { productId }
      if (orderId) {
        bus.emitStage(orderId, 'INDEXED', { productId });
      }

      // Commit Kafka offset (offset + 1)
      await consumer.commitOffsets([
        { topic, partition, offset: (BigInt(message.offset) + 1n).toString() }
      ]);
    }
  });

  console.log(`Search indexer consumer started (group: 'search-indexer', topic: '${TOPICS.StoreStockChanged}')`);
}

async function stop() {
  running = false;
  if (sleepTimeout) {
    clearTimeout(sleepTimeout);
    sleepTimeout = null;
  }
  if (consumer) {
    try {
      await consumer.stop();
      await consumer.disconnect();
    } catch (e) {
      console.warn('Error stopping search indexer consumer:', e.message);
    }
    consumer = null;
  }
}

module.exports = {
  start,
  stop
};
