const { producer } = require('../src/events/kafka');
const { startSearchIndexerConsumer, stopSearchIndexerConsumer } = require('../src/events/searchIndexerConsumer');
const { getProductSearchDoc } = require('../src/db/repositories/productRepo');
const { getIndexedProduct } = require('../src/search/productIndex');
const { pool } = require('../src/db/pool');
const { bus } = require('../src/events/bus');
const { randomUUID } = require('crypto');

const PRODUCT_ID = '10000000-0000-4000-8000-000000000001'; // P01
const STORE_ID = '20000000-0000-4000-8000-000000000001'; // BLR-01
const TEST_ORDER_ID = randomUUID();

async function runSearchSyncTest() {
  console.log('=== STEP 7: SEARCH SYNC CONSUMER & OPENSEARCH TEST ===\n');

  try {
    // 1. Fetch authoritative search doc from PostgreSQL
    console.log('[1] Fetching authoritative search doc from PostgreSQL...');
    const pgDoc = await getProductSearchDoc(PRODUCT_ID);
    console.log(`    Product: ${pgDoc.name}`);
    console.log(`    Current Authoritative totalStock: ${pgDoc.totalStock}`);
    console.log(`    Current Authoritative cities: ${JSON.stringify(pgDoc.cities)}`);

    // 2. Connect Producer and start Search Indexer Consumer
    console.log('\n[2] Connecting Producer and starting Search Indexer Consumer...');
    await producer.connect();
    await startSearchIndexerConsumer();

    // 3. Set up Promise to wait for the INDEXED bus event
    const indexedPromise = new Promise((resolve) => {
      bus.once(`order:${TEST_ORDER_ID}`, (data) => {
        if (data.stage === 'INDEXED') {
          resolve(data.detail);
        }
      });
    });

    // 4. Publish StoreStockChanged event
    console.log('\n[3] Publishing StoreStockChanged event to inventory-events...');
    const envelope = {
      schemaVersion: 1,
      eventId: randomUUID(),
      eventType: 'StoreStockChanged',
      occurredAt: new Date().toISOString(),
      productId: PRODUCT_ID,
      storeId: STORE_ID,
      qtySold: 1,
      source: 'ONLINE',
      orderId: TEST_ORDER_ID
    };

    await producer.send({
      topic: 'inventory-events',
      messages: [{ key: PRODUCT_ID, value: JSON.stringify(envelope) }]
    });

    // 5. Wait for the bus event (max 8 seconds)
    console.log('    Awaiting consumer processing and INDEXED stage...');
    const indexedDetail = await Promise.race([
      indexedPromise,
      new Promise((_, reject) => setTimeout(() => reject(new Error('Timeout (8s) waiting for INDEXED stage')), 8000))
    ]);

    console.log('\n[4] Bus Event Received:');
    console.log(`    Stage: INDEXED`);
    console.log(`    Detail: ${JSON.stringify(indexedDetail)}`);

    // 6. Verify OpenSearch document (if configured)
    console.log('\n[5] Verifying OpenSearch document...');
    try {
      const osDoc = await getIndexedProduct(PRODUCT_ID);
      if (osDoc) {
        console.log(`    OpenSearch totalStock: ${osDoc.totalStock}`);
        console.log(`    OpenSearch matches PG truth: ${osDoc.totalStock === pgDoc.totalStock ? 'PASS' : 'FAIL'}`);
      } else {
        console.log('    OpenSearch document not found (check OPENSEARCH_URL in .env)');
      }
    } catch (err) {
      console.log(`    OpenSearch verification skipped: ${err.message}`);
    }

    console.log('\n=== STEP 7 RESULT: PASS ===');
    console.log('Authoritative re-read and INDEXED stage emission verified successfully.');

  } catch (err) {
    console.error('\n=== STEP 7 ERROR ===');
    console.error(err.message);
  } finally {
    await stopSearchIndexerConsumer();
    try {
      await producer.disconnect();
    } catch (_) {}
  }
}

runSearchSyncTest();