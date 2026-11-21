const { pool, resetDemo, placeOrderAtomic, getInventory } = require('../../src/db');
const { randomUUID } = require('crypto');

const STORE_ID = '20000000-0000-4000-8000-000000000001';
const PRODUCT_ID = '10000000-0000-4000-8000-000000000002'; // P02, stock 10
const CUSTOMER_ID = '30000000-0000-4000-8000-000000000001';

async function runTestE() {
  console.log('=== TEST E: Idempotency Key Twice (Sequential and Concurrent) ===');

  await resetDemo();

  // Part 1: Sequential Idempotency
  console.log('[1] Testing sequential idempotency...');
  const key1 = randomUUID();
  const res1 = await placeOrderAtomic({
    customerId: CUSTOMER_ID,
    storeId: STORE_ID,
    items: [{ productId: PRODUCT_ID, quantity: 1 }],
    idempotencyKey: key1
  });

  const invMid = await getInventory(STORE_ID, PRODUCT_ID);
  console.log(`- 1st call: orderNumber=${res1.order.orderNumber}, replayed=${res1.replayed}, stock=${invMid.stockQty}`);

  const res2 = await placeOrderAtomic({
    customerId: CUSTOMER_ID,
    storeId: STORE_ID,
    items: [{ productId: PRODUCT_ID, quantity: 1 }],
    idempotencyKey: key1
  });

  const invAfterSeq = await getInventory(STORE_ID, PRODUCT_ID);
  console.log(`- 2nd call: orderNumber=${res2.order.orderNumber}, replayed=${res2.replayed}, stock=${invAfterSeq.stockQty}`);

  const seqOrderMatch = res1.order.id === res2.order.id && res1.order.orderNumber === res2.order.orderNumber;
  const seqReplayedMatch = res1.replayed === false && res2.replayed === true;
  const seqStockMatch = invMid.stockQty === invAfterSeq.stockQty;

  const outboxSeqRes = await pool.query(
    "SELECT COUNT(*)::integer AS count FROM outbox_events WHERE event_type = 'OrderPlaced' AND aggregate_id = $1",
    [res1.order.id]
  );
  const outboxSeqCount = Number(outboxSeqRes.rows[0].count);
  console.log(`- OrderPlaced outbox events for order: ${outboxSeqCount} (expected 1)`);

  // Part 2: Concurrent Idempotency
  console.log('\n[2] Testing concurrent idempotency (10 parallel identical requests)...');
  const key2 = randomUUID();
  const stockBeforeConcurrent = (await getInventory(STORE_ID, PRODUCT_ID)).stockQty;

  const concurrentPromises = [];
  for (let i = 0; i < 10; i++) {
    concurrentPromises.push(
      placeOrderAtomic({
        customerId: CUSTOMER_ID,
        storeId: STORE_ID,
        items: [{ productId: PRODUCT_ID, quantity: 1 }],
        idempotencyKey: key2
      })
    );
  }

  const concurrentResults = await Promise.all(concurrentPromises);
  const nonReplayed = concurrentResults.filter((r) => r.replayed === false);
  const replayed = concurrentResults.filter((r) => r.replayed === true);

  const firstOrderId = concurrentResults[0].order.id;
  const allSameOrder = concurrentResults.every((r) => r.order.id === firstOrderId);

  const stockAfterConcurrent = (await getInventory(STORE_ID, PRODUCT_ID)).stockQty;
  const stockDeductionMatch = stockBeforeConcurrent - stockAfterConcurrent === 1;

  const outboxConcRes = await pool.query(
    "SELECT COUNT(*)::integer AS count FROM outbox_events WHERE event_type = 'OrderPlaced' AND aggregate_id = $1",
    [firstOrderId]
  );
  const outboxConcCount = Number(outboxConcRes.rows[0].count);

  console.log(`- Non-replayed count: ${nonReplayed.length} (expected 1)`);
  console.log(`- Replayed count: ${replayed.length} (expected 9)`);
  console.log(`- All responses returned identical order ID: ${allSameOrder}`);
  console.log(`- Stock decreased by exactly 1 unit: ${stockDeductionMatch} (from ${stockBeforeConcurrent} to ${stockAfterConcurrent})`);
  console.log(`- Outbox OrderPlaced count: ${outboxConcCount} (expected 1)`);

  const passed =
    seqOrderMatch &&
    seqReplayedMatch &&
    seqStockMatch &&
    outboxSeqCount === 1 &&
    nonReplayed.length === 1 &&
    replayed.length === 9 &&
    allSameOrder &&
    stockDeductionMatch &&
    outboxConcCount === 1;

  if (passed) {
    console.log('-> TEST E STATUS: PASS\n');
    return true;
  } else {
    console.error('-> TEST E STATUS: FAIL\n');
    return false;
  }
}

if (require.main === module) {
  runTestE()
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

module.exports = { runTestE };
