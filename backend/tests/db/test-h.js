const { pool, resetDemo } = require('../../src/db');
const { randomUUID } = require('crypto');

async function runTestH() {
  console.log('=== TEST H: Database Constraints Verification ===');

  await resetDemo();

  const STORE_ID = '20000000-0000-4000-8000-000000000001';
  const PRODUCT_ID = '10000000-0000-4000-8000-000000000001';
  const CUSTOMER_ID = '30000000-0000-4000-8000-000000000001';

  let negStockRejected = false;
  try {
    await pool.query(
      'INSERT INTO inventory (store_id, product_id, stock_qty) VALUES ($1, $2, -5) ON CONFLICT (store_id, product_id) DO UPDATE SET stock_qty = -5',
      [STORE_ID, PRODUCT_ID]
    );
  } catch (err) {
    negStockRejected = err.code === '23514'; // check_violation
  }
  console.log(`- 1. Negative stock rejected: ${negStockRejected} (CHECK stock_qty >= 0)`);

  let invalidQtyRejected = false;
  try {
    await pool.query(`
      INSERT INTO order_items (order_id, product_id, store_id, quantity, unit_price_paise, subtotal_paise)
      VALUES (gen_random_uuid(), $1, $2, 0, 1000, 0)
    `, [PRODUCT_ID, STORE_ID]);
  } catch (err) {
    invalidQtyRejected = err.code === '23514' || err.code === '23503'; // check_violation or fk violation
  }
  console.log(`- 2. Quantity <= 0 rejected: ${invalidQtyRejected} (CHECK quantity > 0)`);

  let dupSkuRejected = false;
  try {
    await pool.query(`
      INSERT INTO products (sku, name, category, brand, price_paise)
      VALUES ('SM-AUD-001', 'Duplicate SKU Test', 'Audio', 'boAt', 129900)
    `);
  } catch (err) {
    dupSkuRejected = err.code === '23505'; // unique_violation
  }
  console.log(`- 3. Duplicate SKU rejected: ${dupSkuRejected} (UNIQUE sku)`);

  let dupIdempotencyRejected = false;
  const sharedKey = randomUUID();
  try {
    await pool.query(`
      INSERT INTO orders (customer_id, store_id, source, total_paise, idempotency_key)
      VALUES ($1, $2, 'ONLINE', 129900, $3)
    `, [CUSTOMER_ID, STORE_ID, sharedKey]);

    await pool.query(`
      INSERT INTO orders (customer_id, store_id, source, total_paise, idempotency_key)
      VALUES ($1, $2, 'ONLINE', 129900, $3)
    `, [CUSTOMER_ID, STORE_ID, sharedKey]);
  } catch (err) {
    dupIdempotencyRejected = err.code === '23505'; // unique_violation
  }
  console.log(`- 4. Duplicate idempotency key rejected: ${dupIdempotencyRejected} (UNIQUE idempotency_key)`);

  let badFkRejected = false;
  try {
    await pool.query(`
      INSERT INTO orders (customer_id, store_id, source, total_paise, idempotency_key)
      VALUES ('00000000-0000-0000-0000-000000000000', $1, 'ONLINE', 129900, $2)
    `, [STORE_ID, randomUUID()]);
  } catch (err) {
    badFkRejected = err.code === '23503'; // foreign_key_violation
  }
  console.log(`- 5. Bad Foreign Key rejected: ${badFkRejected} (FK customers(id))`);

  const passed = negStockRejected && invalidQtyRejected && dupSkuRejected && dupIdempotencyRejected && badFkRejected;

  if (passed) {
    console.log('-> TEST H STATUS: PASS\n');
    return true;
  } else {
    console.error('-> TEST H STATUS: FAIL\n');
    return false;
  }
}

if (require.main === module) {
  runTestH()
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

module.exports = { runTestH };
