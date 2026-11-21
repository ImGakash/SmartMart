const { pool, resetDemo, placeOrderAtomic, recordPosSale, getInventory } = require('../../src/db');
const { randomUUID } = require('crypto');

const STORE_ID = '20000000-0000-4000-8000-000000000001';
const PRODUCT_ID = '10000000-0000-4000-8000-000000000001';
const CUSTOMER_ID = '30000000-0000-4000-8000-000000000001';

async function runTestD() {
  console.log('=== TEST D: POS vs Online Concurrent Checkout (Stock=1) ===');

  await resetDemo();

  await pool.query(
    'UPDATE inventory SET stock_qty = 1 WHERE store_id = $1 AND product_id = $2',
    [STORE_ID, PRODUCT_ID]
  );
  const initialInv = await getInventory(STORE_ID, PRODUCT_ID);
  console.log(`- Initial stock verified: ${initialInv.stockQty}`);

  const [onlineRes, posRes] = await Promise.all([
    placeOrderAtomic({
      customerId: CUSTOMER_ID,
      storeId: STORE_ID,
      items: [{ productId: PRODUCT_ID, quantity: 1 }],
      idempotencyKey: randomUUID()
    })
      .then((r) => ({ status: 'SUCCESS', source: r.order.source, order: r.order }))
      .catch((err) => ({ status: 'FAILED', code: err.code })),
    recordPosSale({
      storeId: STORE_ID,
      items: [{ productId: PRODUCT_ID, quantity: 1 }],
      idempotencyKey: randomUUID()
    })
      .then((r) => ({ status: 'SUCCESS', source: r.order.source, order: r.order }))
      .catch((err) => ({ status: 'FAILED', code: err.code }))
  ]);

  let winner = null;
  let winningSource = null;
  let losingError = null;

  if (onlineRes.status === 'SUCCESS' && posRes.status === 'FAILED') {
    winner = 'online';
    winningSource = onlineRes.source;
    losingError = posRes.code;
  } else if (posRes.status === 'SUCCESS' && onlineRes.status === 'FAILED') {
    winner = 'pos';
    winningSource = posRes.source;
    losingError = onlineRes.code;
  }

  const finalInv = await getInventory(STORE_ID, PRODUCT_ID);

  console.log(`- Winning Request: ${winner}`);
  console.log(`- Winner 'source' field: "${winningSource}"`);
  console.log(`- Losing Request Error: "${losingError}"`);
  console.log(`- Final stock_qty: ${finalInv.stockQty}`);

  const passed = winner !== null && (winningSource === 'ONLINE' || winningSource === 'POS_STORE') && losingError === 'INSUFFICIENT_STOCK' && finalInv.stockQty === 0;

  if (passed) {
    console.log('-> TEST D STATUS: PASS\n');
    return true;
  } else {
    console.error('-> TEST D STATUS: FAIL\n');
    return false;
  }
}

if (require.main === module) {
  runTestD()
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

module.exports = { runTestD };
