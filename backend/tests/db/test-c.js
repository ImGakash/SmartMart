const { pool, resetDemo, placeOrderAtomic, getInventory } = require('../../src/db');
const { randomUUID } = require('crypto');

const STORE_ID = '20000000-0000-4000-8000-000000000001'; // BLR-01
const P01_ID = '10000000-0000-4000-8000-000000000001';   // stock 1
const P02_ID = '10000000-0000-4000-8000-000000000002';   // stock 10
const CUSTOMER_ID = '30000000-0000-4000-8000-000000000001';

async function runTestC() {
  console.log('=== TEST C: Multi-item Cart, Second Item Unavailable (Full Rollback) ===');

  await resetDemo();

  const inv1Before = await getInventory(STORE_ID, P01_ID);
  const inv2Before = await getInventory(STORE_ID, P02_ID);
  const ordersBefore = await pool.query('SELECT COUNT(*)::integer AS count FROM orders');
  const itemsBefore = await pool.query('SELECT COUNT(*)::integer AS count FROM order_items');
  const outboxBefore = await pool.query('SELECT COUNT(*)::integer AS count FROM outbox_events');

  console.log(`- Pre-check: P02 stock=${inv2Before.stockQty}, P01 stock=${inv1Before.stockQty}`);

  let caughtError = null;
  try {
    await placeOrderAtomic({
      customerId: CUSTOMER_ID,
      storeId: STORE_ID,
      items: [
        { productId: P02_ID, quantity: 2 }, // available (10 >= 2)
        { productId: P01_ID, quantity: 5 }  // unavailable (1 < 5)
      ],
      idempotencyKey: randomUUID()
    });
  } catch (err) {
    caughtError = err;
  }

  console.log(`- Caught error code: ${caughtError ? caughtError.code : 'NONE'} (expected INSUFFICIENT_STOCK)`);

  const inv1After = await getInventory(STORE_ID, P01_ID);
  const inv2After = await getInventory(STORE_ID, P02_ID);
  const ordersAfter = await pool.query('SELECT COUNT(*)::integer AS count FROM orders');
  const itemsAfter = await pool.query('SELECT COUNT(*)::integer AS count FROM order_items');
  const outboxAfter = await pool.query('SELECT COUNT(*)::integer AS count FROM outbox_events');

  const stock1Match = inv1After.stockQty === inv1Before.stockQty;
  const stock2Match = inv2After.stockQty === inv2Before.stockQty;
  const ordersMatch = Number(ordersAfter.rows[0].count) === Number(ordersBefore.rows[0].count);
  const itemsMatch = Number(itemsAfter.rows[0].count) === Number(itemsBefore.rows[0].count);
  const outboxMatch = Number(outboxAfter.rows[0].count) === Number(outboxBefore.rows[0].count);

  console.log(`- Stock unchanged: P02=${stock2Match}, P01=${stock1Match}`);
  console.log(`- Orders count unchanged: ${ordersMatch}`);
  console.log(`- Order items unchanged: ${itemsMatch}`);
  console.log(`- Outbox rows unchanged: ${outboxMatch}`);

  const passed =
    caughtError &&
    caughtError.code === 'INSUFFICIENT_STOCK' &&
    stock1Match &&
    stock2Match &&
    ordersMatch &&
    itemsMatch &&
    outboxMatch;

  if (passed) {
    console.log('-> TEST C STATUS: PASS\n');
    return true;
  } else {
    console.error('-> TEST C STATUS: FAIL\n');
    return false;
  }
}

if (require.main === module) {
  runTestC()
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

module.exports = { runTestC };
