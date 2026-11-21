const { createConsumer } = require('./kafka');
const { getProductSearchDoc } = require('../db/repositories/productRepo');
const { upsertProductSearchDoc } = require('../search/productIndex');
const { chaos } = require('./chaos');
const { emitStage } = require('./bus');

let consumer = null;

/**
 * Search Sync Service Consumer (Consumer Group: 'search-indexer')
 * Subscribes to topic 'inventory-events'.
 * 
 * Rules (§8):
 * 1. Honors chaos switch `search-indexer` (pauses processing in loop).
 * 2. Reads payload: `{ productId, storeId, qtySold, source, orderId }`.
 * 3. Authoritative Re-read: Calls `getProductSearchDoc(payload.productId)`.
 *    NEVER index stock numbers from the event payload.
 * 4. Deterministic upsert into OpenSearch (`_id = productId`, `refresh: 'wait_for'`).
 * 5. Emits SSE `INDEXED` stage for `orderId` with `{ productId }` in detail.
 * 6. Commits Kafka offset after processing completes.
 */
async function startSearchIndexerConsumer() {
  consumer = createConsumer('search-indexer');
  await consumer.connect();
  await consumer.subscribe({ topic: 'inventory-events', fromBeginning: true });

  console.log('[SearchIndexerConsumer] Subscribed to inventory-events');

  await consumer.run({
    autoCommit: false,
    eachMessage: async ({ topic, partition, message }) => {
      // 1. Chaos switch check: pause processing if active
      while (chaos['search-indexer']) {
        await new Promise((resolve) => setTimeout(resolve, 500));
      }

      let payload;
      try {
        payload = JSON.parse(message.value.toString());
      } catch (parseErr) {
        console.error(`[SearchIndexerConsumer] Poison pill at offset ${message.offset}:`, parseErr.message);
        await consumer.commitOffsets([
          { topic, partition, offset: (BigInt(message.offset) + 1n).toString() }
        ]);
        return;
      }

      const { productId, orderId } = payload;
      if (!productId) {
        await consumer.commitOffsets([
          { topic, partition, offset: (BigInt(message.offset) + 1n).toString() }
        ]);
        return;
      }

      try {
        // 2. Authoritative re-read from PostgreSQL (NEVER index stock from event payload)
        const doc = await getProductSearchDoc(productId);

        // 3. Upsert to OpenSearch if configured
        try {
          await upsertProductSearchDoc(doc);
        } catch (searchErr) {
          console.warn(`[SearchIndexerConsumer] OpenSearch indexing skipped or failed for ${productId}:`, searchErr.message);
        }

        // 4. Emit SSE stage INDEXED with detail: { productId }
        if (orderId) {
          emitStage(orderId, {
            stage: 'INDEXED',
            detail: { productId, totalStock: doc.totalStock, cities: doc.cities }
          });
        }

        // 5. Commit offset + 1
        await consumer.commitOffsets([
          {
            topic,
            partition,
            offset: (BigInt(message.offset) + 1n).toString()
          }
        ]);

      } catch (err) {
        console.error(`[SearchIndexerConsumer] Failed to process inventory event for product ${productId}:`, err.message);
        throw err;
      }
    }
  });
}

async function stopSearchIndexerConsumer() {
  if (consumer) {
    await consumer.disconnect();
    consumer = null;
    console.log('[SearchIndexerConsumer] Disconnected');
  }
}

module.exports = {
  startSearchIndexerConsumer,
  stopSearchIndexerConsumer
};
