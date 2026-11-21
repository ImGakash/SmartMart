const { pool, resetDemo, placeOrderAtomic, getInventory } = require('../../src/db');
const { randomUUID } = require('crypto');

const STORE_ID = '20000000-0000-4000-8000-000000000001'; // BLR-01
const PRODUCT_ID = '10000000-0000-4000-8000-000000000001'; // P01

async function runTestA() {
  console.log('=== TEST A: Stock=1, 50 Concurrent Buyers ===');

  await resetDemo();

  // Verify initial stock = 1
  const initial = await getInventory(STORE_ID, PRODUCT_ID);
  if (initial.stockQty !== 1) {
    throw new Error(`Expected initial stock 1, got ${initial.stockQty}`);
  }

  // 50 concurrent requests with distinct seeded customers and distinct idempotency keys
  const requests = [];
  for (let i = 1; i <= 50; i++) {
    const pad = String(i).padStart(2, '0');
    const customerId = `30000000-0000-4000-8000-0000000000${pad}`;
    const idempotencyKey = randomUUID();

    requests.push(
      placeOrderAtomic({
        customerId,
        storeId: STORE_ID,
        items: [{ productId: PRODUCT_ID, quantity: 1 }],
        idempotencyKey
      }).then(
        (res) => ({ status: 'SUCCESS', res }),
        (err) => ({ status: 'FAILED', code: err.code })
      )
    );
  }

  const results = await Promise.all(requests);
  const successes = results.filter((r) => r.status === 'SUCCESS');
  const failures = results.filter((r) => r.status === 'FAILED');
  const stockErrors = failures.filter((r) => r.code === 'INSUFFICIENT_STOCK');

  const finalInv = await getInventory(STORE_ID, PRODUCT_ID);

  console.log(`- Successes: ${successes.length} (expected 1)`);
  console.log(`- Failures: ${failures.length} (expected 49, all INSUFFICIENT_STOCK: ${stockErrors.length})`);
  console.log(`- Final stock: ${finalInv.stockQty} (expected 0)`);

  const orderCountRes = await pool.query(
    'SELECT COUNT(*)::integer AS count FROM order_items WHERE product_id = $1 AND store_id = $2',
    [PRODUCT_ID, STORE_ID]
  );
  const orderCount = Number(orderCountRes.rows[0].count);
  console.log(`- Orders in DB: ${orderCount} (expected 1)`);

  const passed = successes.length === 1 && failures.length === 49 && stockErrors.length === 49 && finalInv.stockQty === 0 && orderCount === 1;

  if (passed) {
    console.log('-> TEST A STATUS: PASS\n');
    return true;
  } else {
    console.error('-> TEST A STATUS: FAIL\n');
    return false;
  }
}

if (require.main === module) {
  runTestA()
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

module.exports = { runTestA };
