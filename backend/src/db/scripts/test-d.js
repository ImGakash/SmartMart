const { pool, getInventory } = require('../index');
const { randomUUID } = require('crypto');
const http = require('http');
const app = require('../../api/server');

const STORE_ID = '20000000-0000-4000-8000-000000000001';
const PRODUCT_ID = '10000000-0000-4000-8000-000000000001';
const CUSTOMER_ID = '30000000-0000-4000-8000-000000000001';

function postRequest(port, path, headers, body) {
  return new Promise((resolve, reject) => {
    const data = JSON.stringify(body);
    const req = http.request(
      {
        hostname: '127.0.0.1',
        port,
        path,
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(data),
          ...headers
        }
      },
      (res) => {
        let respData = '';
        res.on('data', (chunk) => (respData += chunk));
        res.on('end', () => {
          try {
            resolve({ statusCode: res.statusCode, body: JSON.parse(respData) });
          } catch (e) {
            resolve({ statusCode: res.statusCode, rawBody: respData });
          }
        });
      }
    );
    req.on('error', reject);
    req.write(data);
    req.end();
  });
}

async function runTestD() {
  console.log('=== Test D: POS vs Online Concurrent Checkout (Stock=1) ===\n');

  // 1. Set inventory stock to 1
  console.log('[1] Setting stock_qty to 1 in inventory...');
  await pool.query(
    'UPDATE inventory SET stock_qty = 1 WHERE store_id = $1 AND product_id = $2',
    [STORE_ID, PRODUCT_ID]
  );
  const initialInv = await getInventory(STORE_ID, PRODUCT_ID);
  console.log(`Initial stock verified: ${initialInv.stockQty}`);

  // Start internal server
  const server = http.createServer(app);
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const port = server.address().port;

  try {
    // 2. Fire two concurrent requests
    console.log('\n[2] Firing two concurrent requests (Online vs POS)...');
    const onlinePayload = {
      storeId: STORE_ID,
      items: [{ productId: PRODUCT_ID, quantity: 1 }]
    };
    const onlineHeaders = {
      'X-Customer-Id': CUSTOMER_ID,
      'Idempotency-Key': randomUUID()
    };

    const posPayload = {
      storeId: STORE_ID,
      items: [{ productId: PRODUCT_ID, quantity: 1 }]
    };

    const [onlineRes, posRes] = await Promise.all([
      postRequest(port, '/checkout', onlineHeaders, onlinePayload),
      postRequest(port, '/pos/sale', {}, posPayload)
    ]);

    console.log('\n[3] Responses Received:');
    console.log('Online Response:', JSON.stringify(onlineRes, null, 2));
    console.log('POS Response:', JSON.stringify(posRes, null, 2));

    let winner = null;
    let winningSource = null;
    let losingError = null;

    if (onlineRes.statusCode === 201 && posRes.statusCode === 409) {
      winner = 'online';
      winningSource = onlineRes.body.order.source;
      losingError = posRes.body.error ? posRes.body.error.code : posRes.body;
    } else if (posRes.statusCode === 201 && onlineRes.statusCode === 409) {
      winner = 'pos';
      winningSource = posRes.body.order.source;
      losingError = onlineRes.body.error ? onlineRes.body.error.code : onlineRes.body;
    } else {
      console.error('CONCURRENCY ISSUE: Neither or both succeeded!');
    }

    // 4. Verify final stock quantity
    const finalInv = await getInventory(STORE_ID, PRODUCT_ID);

    console.log('\n=== TEST D RESULTS ===');
    console.log(`- Winning Request: ${winner}`);
    console.log(`- Winner 'source' field: "${winningSource}"`);
    console.log(`- Losing Request Error: ${JSON.stringify(losingError)}`);
    console.log(`- Final stock_qty: ${finalInv.stockQty}`);

    if (winner && (onlineRes.statusCode === 201 || posRes.statusCode === 201) && finalInv.stockQty === 0) {
      console.log('\n-> PASS: Exactly one succeeded, exactly one failed with stock error, final stock is 0.');
    } else {
      console.log('\n-> FAIL: Test conditions not met.');
    }

  } finally {
    server.close();
    await pool.end();
  }
}

runTestD().catch(console.error);
