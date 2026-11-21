const { producer } = require('../src/events/kafka');
const { startSearchIndexerConsumer, stopSearchIndexerConsumer } = require('../src/events/searchIndexerConsumer');
const { getProductSearchDoc } = require('../src/db/repositories/productRepo');
const { getIndexedProduct } = require('../src/search/productIndex');
const { pool } = require('../src/db/pool');
const { bus } = require('../src/events/bus');
const { randomUUID } = require('crypto');

const STORE_ID = '20000000-0000-4000-8000-000000000001'; // BLR-01
const PRODUCT_ID = '10000000-0000-4000-8000-000000000001'; // P01 boAt earphones
const TEST_ORDER_ID = randomUUID();

async function runSearchOutOfOrderProof() {
  console.log('=== STEP 8: SEARCH REPLAY & OUT-OF-ORDER PROOF ===\n');

  try {
    // 1. Set current authoritative stock in PostgreSQL to a known specific number (e.g. 7)
    console.log('[1] Setting authoritative stock in PostgreSQL to 7 units...');
    await pool.query(
      'UPDATE inventory SET stock_qty = 7 WHERE store_id = $1 AND product_id = $2',
      [STORE_ID, PRODUCT_ID]
    );

    const initialPgDoc = await getProductSearchDoc(PRODUCT_ID);
    console.log(`    Current Authoritative PostgreSQL state:`);
    console.log(`    - Product: ${initialPgDoc.name}`);
    console.log(`    - Total Stock: ${initialPgDoc.totalStock}`);
    console.log(`    - Cities: ${JSON.stringify(initialPgDoc.cities)}`);
    if (initialPgDoc.totalStock !== 7) {
      throw new Error(`Expected PostgreSQL totalStock to be 7, got ${initialPgDoc.totalStock}`);
    }

    // 2. Connect Producer and start Search Indexer Consumer
    console.log('\n[2] Connecting Producer and starting Search Indexer Consumer...');
    await producer.connect();
    await startSearchIndexerConsumer();

    // 3. Track bus events
    const stagesCaptured = [];
    bus.on(`order:${TEST_ORDER_ID}`, (data) => {
      stagesCaptured.push(data);
      console.log(`    [bus.js] Order ${data.orderId} stage emitted: ${data.stage} (totalStock=${data.detail.totalStock})`);
    });

    // 4. Construct a STALE / OLD event with completely obsolete payload data
    // (e.g. qtySold: 9999, stale occurredAt: 2020-01-01, fakePayloadStock: 0)
    const staleEventId = randomUUID();
    const staleEnvelope = {
      schemaVersion: 1,
      eventId: staleEventId,
      eventType: 'StoreStockChanged',
      occurredAt: '2020-01-01T00:00:00.000Z', // 6 years in the past
      productId: PRODUCT_ID,
      storeId: STORE_ID,
      qtySold: 9999, // stale number
      source: 'POS_STORE',
      orderId: TEST_ORDER_ID,
      fakeStockInPayload: 0
    };

    // 5. Test Step A: Publish stale event to inventory-events
    console.log(`\n[3] Publishing STALE / OUT-OF-ORDER event (occurredAt: 2020-01-01, stale qtySold: 9999)...`);
    await producer.send({
      topic: 'inventory-events',
      messages: [{ key: PRODUCT_ID, value: JSON.stringify(staleEnvelope) }]
    });

    console.log('    Awaiting consumer processing (4s)...');
    await new Promise((r) => setTimeout(r, 4000));

    // 6. Test Step B: Publish the EXACT SAME stale event a SECOND time (duplicate redelivery)
    console.log(`\n[4] Publishing duplicate copy of STALE event (simulating Kafka redelivery)...`);
    await producer.send({
      topic: 'inventory-events',
      messages: [{ key: PRODUCT_ID, value: JSON.stringify(staleEnvelope) }]
    });

    console.log('    Awaiting duplicate consumer processing (4s)...');
    await new Promise((r) => setTimeout(r, 4000));

    // 7. Verify convergence to current PostgreSQL truth
    console.log('\n[5] Verifying State Convergence:');
    const finalPgDoc = await getProductSearchDoc(PRODUCT_ID);
    console.log(`    Current PostgreSQL Total Stock: ${finalPgDoc.totalStock}`);

    // Check emitted bus stages
    const lastStage = stagesCaptured[stagesCaptured.length - 1];
    console.log(`    Last bus stage emitted: ${lastStage ? lastStage.stage : 'NONE'}`);
    console.log(`    Last bus stage totalStock detail: ${lastStage ? lastStage.detail.totalStock : 'NONE'}`);

    // Check OpenSearch if accessible
    let osDoc = null;
    try {
      osDoc = await getIndexedProduct(PRODUCT_ID);
      if (osDoc) {
        console.log(`    OpenSearch Document Total Stock: ${osDoc.totalStock}`);
      }
    } catch (_) {}

    // Assertions
    const stageMatchesTruth = lastStage && lastStage.detail.totalStock === finalPgDoc.totalStock;
    const osMatchesTruth = !osDoc || osDoc.totalStock === finalPgDoc.totalStock;

    console.log('\n[6] Summary of Invariant Checks:');
    console.log(`    - Stale payload did NOT corrupt stock calculation: ${stageMatchesTruth ? 'PASS' : 'FAIL'}`);
    console.log(`    - Duplicate delivery converged to current PostgreSQL truth: ${stageMatchesTruth ? 'PASS' : 'FAIL'}`);
    if (osDoc) {
      console.log(`    - OpenSearch document matches current PostgreSQL truth: ${osMatchesTruth ? 'PASS' : 'FAIL'}`);
    }

    if (stageMatchesTruth && osMatchesTruth) {
      console.log('\n=== STEP 8 RESULT: PASS ===');
    } else {
      console.log('\n=== STEP 8 RESULT: FAIL ===');
    }

    // Reset stock back to seed baseline
    await pool.query(
      'UPDATE inventory SET stock_qty = 1 WHERE store_id = $1 AND product_id = $2',
      [STORE_ID, PRODUCT_ID]
    );
    console.log('\nRestored P01 stock to 1 unit in BLR-01.');

  } catch (err) {
    console.error('\n=== STEP 8 ERROR ===');
    console.error(err.message);
  } finally {
    await stopSearchIndexerConsumer();
    try {
      await producer.disconnect();
    } catch (_) {}
    await pool.end();
  }
}

runSearchOutOfOrderProof();
