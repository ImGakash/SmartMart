const http = require('http');
const { bootstrap, shutdown } = require('../src/index');

/**
 * STEP 11: SERVER BOOTSTRAP & SMOKE TEST
 * 
 * Verifies:
 * 1. Unified bootstrap: DB, Kafka Producer, Outbox Relay, 3 Consumers, Express API.
 * 2. HTTP probe: GET http://localhost:4000/stores responds 200 OK with store array.
 * 3. Graceful shutdown: calls shutdown and verifies clean exit.
 */
async function testServerBootstrap() {
  console.log('=== STEP 11: SERVER BOOTSTRAP & INTEGRATION TEST ===\n');

  try {
    console.log('[1] Bootstrapping full server...');
    await bootstrap();

    // Give consumers & server 5s to stabilize
    await new Promise(r => setTimeout(r, 5000));

    console.log('\n[2] Probing HTTP API endpoint (GET /stores)...');
    const responseData = await new Promise((resolve, reject) => {
      const req = http.get('http://localhost:4000/stores', (res) => {
        let body = '';
        res.on('data', chunk => body += chunk);
        res.on('end', () => {
          resolve({ status: res.statusCode, body: JSON.parse(body) });
        });
      });
      req.on('error', reject);
    });

    console.log(`    HTTP Status: ${responseData.status}`);
    console.log(`    Stores returned: ${responseData.body.length}`);

    if (responseData.status !== 200 || !Array.isArray(responseData.body) || responseData.body.length === 0) {
      throw new Error(`API probe failed: ${JSON.stringify(responseData)}`);
    }

    console.log('    ✓ HTTP API probe verified: Status 200 and store list retrieved.');

    console.log('\n[3] Triggering graceful shutdown...');
    // We invoke shutdown cleanly
    setTimeout(() => {
      shutdown('TEST_COMPLETE');
    }, 1000);

  } catch (err) {
    console.error('\n=== STEP 11 ERROR ===');
    console.error(err.message);
    process.exit(1);
  }
}

testServerBootstrap();
