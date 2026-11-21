const { pool, resetDemo, placeOrderAtomic, getInventory } = require('../../src/db');
const { randomUUID } = require('crypto');

const STORE_ID = '20000000-0000-4000-8000-000000000001'; // BLR-01
const PRODUCT_ID = '10000000-0000-4000-8000-000000000001'; // P01

async function runTestB() {
  console.log('=== TEST B: Stock=10, 50 Buyers ===');

  await resetDemo();

  // Set stock to 10
  await pool.query(
    'UPDATE inventory SET stock_qty = 10 WHERE store_id = $1 AND product_id = $2',
    [STORE_ID, PRODUCT_ID]
  );
  await pool.query(
    'UPDATE inventory_baseline SET baseline_qty = 10 WHERE store_id = $1 AND product_id = $2',
    [STORE_ID, PRODUCT_ID]
  );

  const initial = await getInventory(STORE_ID, PRODUCT_ID);
  if (initial.stockQty !== 10) {
    throw new Error(`Expected initial stock 10, got ${initial.stockQty}`);
  }

  // 50 concurrent buyers
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

  console.log(`- Successes: ${successes.length} (expected 10)`);
  console.log(`- Failures: ${failures.length} (expected 40, all INSUFFICIENT_STOCK: ${stockErrors.length})`);
  console.log(`- Final stock: ${finalInv.stockQty} (expected 0)`);

  const passed = successes.length === 10 && failures.length === 40 && stockErrors.length === 40 && finalInv.stockQty === 0;

  if (passed) {
    console.log('-> TEST B STATUS: PASS\n');
    return true;
  } else {
    console.error('-> TEST B STATUS: FAIL\n');
    return false;
  }
}

if (require.main === module) {
  runTestB()
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

module.exports = { runTestB };
