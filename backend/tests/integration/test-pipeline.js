const { randomUUID } = require('crypto');
const http = require('http');
const { pool } = require('../../src/db');
const { getProducer, connectProducer, disconnectAll, TOPICS } = require('../../src/events/kafka');
const bus = require('../../src/events/bus');

const BASE_URL = 'http://localhost:4000';

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function apiRequest(path, options = {}) {
  const url = `${BASE_URL}${path}`;
  const method = options.method || 'GET';
  const headers = {
    'Content-Type': 'application/json',
    ...(options.headers || {})
  };

  const res = await fetch(url, {
    method,
    headers,
    body: options.body ? JSON.stringify(options.body) : undefined
  });

  const text = await res.text();
  let json;
  try {
    json = JSON.parse(text);
  } catch {
    json = text;
  }

  return { status: res.status, ok: res.ok, body: json };
}

function listenOrderSse(orderId, timeoutMs = 10000) {
  return new Promise((resolve, reject) => {
    const stagesReceived = [];
    const url = `${BASE_URL}/api/orders/${orderId}/events`;

    const req = http.get(url, (res) => {
      let buffer = '';
      res.on('data', (chunk) => {
        buffer += chunk.toString();
        const lines = buffer.split('\n');
        buffer = lines.pop(); // keep partial

        let currentEvent = null;
        for (const line of lines) {
          if (line.startsWith('event: ')) {
            currentEvent = line.slice(7).trim();
          } else if (line.startsWith('data: ') && currentEvent === 'stage') {
            try {
              const data = JSON.parse(line.slice(6).trim());
              stagesReceived.push(data.stage);
              // If we received all 4 core stages, resolve early
              if (
                stagesReceived.includes('COMMITTED') &&
                stagesReceived.includes('OUTBOX_PUBLISHED') &&
                stagesReceived.includes('NOTIFIED') &&
                stagesReceived.includes('INDEXED')
              ) {
                req.destroy();
                resolve(stagesReceived);
              }
            } catch (e) {}
          }
        }
      });

      res.on('error', (err) => {
        reject(err);
      });
    });

    req.on('error', (err) => {
      reject(err);
    });

    setTimeout(() => {
      req.destroy();
      resolve(stagesReceived);
    }, timeoutMs);
  });
}

async function runPipelineVerification() {
  console.log('================================================================');
  console.log('  SmartMart Gate 3: End-to-End Pipeline & Acceptance Tests');
  console.log('================================================================\n');

  let p01Id, p02Id, p03Id, p04Id, blrStoreId, c01Id;

  const P01_ID = '10000000-0000-4000-8000-000000000001';
  const P02_ID = '10000000-0000-4000-8000-000000000002';
  const P03_ID = '10000000-0000-4000-8000-000000000003';
  const P_OTHER_ID = '10000000-0000-4000-8000-000000000005';
  const BLR_STORE_ID = '20000000-0000-4000-8000-000000000001';
  const C01_ID = '30000000-0000-4000-8000-000000000001';

  p01Id = P01_ID;
  p02Id = P02_ID;
  p03Id = P03_ID;
  p04Id = P_OTHER_ID;
  blrStoreId = BLR_STORE_ID;
  c01Id = C01_ID;

  // --------------------------------------------------------------------------
  // a) POST /api/demo/reset → 10/10 consistency PASS, P01 stock 1
  // --------------------------------------------------------------------------
  console.log('--- Step (a): Reset demo & verify 10/10 invariants ---');
  const resetRes = await apiRequest('/api/demo/reset', { method: 'POST' });
  console.log(`POST /api/demo/reset: status ${resetRes.status}, duration ${resetRes.body.durationMs}ms`);

  const metricsRes = await apiRequest('/api/xray/metrics');
  const checks = metricsRes.body.consistency.checks;
  const passCount = checks.filter((c) => c.status === 'PASS').length;
  console.log(`Consistency Report: ${passCount}/10 checks PASS`);
  for (const c of checks) {
    console.log(`  [${c.status}] ${c.name}: ${c.detail}`);
  }

  const p01StockRes = await pool.query(
    'SELECT stock_qty FROM inventory WHERE product_id = $1 AND store_id = $2',
    [p01Id, blrStoreId]
  );
  const p01Stock = Number(p01StockRes.rows[0].stock_qty);
  console.log(`P01 stock in BLR-01: ${p01Stock} (expected: 1)`);

  if (passCount !== 10 || p01Stock !== 1) {
    throw new Error('Step (a) failed: 10/10 consistency or P01 stock mismatch');
  }
  console.log('-> Step (a) PASSED\n');

  // --------------------------------------------------------------------------
  // b) POST /api/checkout → SSE stream shows all 4 stages: COMMITTED → OUTBOX_PUBLISHED → NOTIFIED → INDEXED
  // --------------------------------------------------------------------------
  console.log('--- Step (b): Checkout & Live SSE Timeline (4 stages) ---');
  const idempotencyKey = randomUUID();

  // Listen on bus stage events for this order as fallback / verification
  let sseOrderPromise;
  let orderResult;

  const checkoutPromise = apiRequest('/api/checkout', {
    method: 'POST',
    headers: {
      'x-customer-id': c01Id,
      'idempotency-key': idempotencyKey
    },
    body: {
      storeId: blrStoreId,
      items: [{ productId: p04Id, quantity: 1 }]
    }
  });

  const resCheckout = await checkoutPromise;
  console.log(`POST /api/checkout: status ${resCheckout.status}, body:`, JSON.stringify(resCheckout.body));
  orderResult = resCheckout.body.order;

  // Listen to SSE /api/orders/:id/events
  const stages = await listenOrderSse(orderResult.id, 8000);
  console.log('Received SSE timeline stages:', stages);

  const hasCommitted = stages.includes('COMMITTED');
  const hasOutboxPub = stages.includes('OUTBOX_PUBLISHED');
  const hasNotified = stages.includes('NOTIFIED');
  const hasIndexed = stages.includes('INDEXED');

  console.log(`  COMMITTED:        ${hasCommitted}`);
  console.log(`  OUTBOX_PUBLISHED: ${hasOutboxPub}`);
  console.log(`  NOTIFIED:         ${hasNotified}`);
  console.log(`  INDEXED:          ${hasIndexed}`);

  if (!hasCommitted || !hasOutboxPub || !hasNotified || !hasIndexed) {
    throw new Error('Step (b) failed: Did not receive all 4 stages over SSE');
  }
  console.log('-> Step (b) PASSED\n');

  // --------------------------------------------------------------------------
  // c) DB proof: outbox all PUBLISHED; 1 notification row; 1 processed_events row
  // --------------------------------------------------------------------------
  console.log('--- Step (c): Database Proof for Checkout ---');
  const outboxRows = await pool.query(
    `SELECT event_type, status, attempts, published_at FROM outbox_events WHERE aggregate_id = $1::uuid OR (payload->>'orderId') = $1::text`,
    [orderResult.id]
  );
  console.log(`Outbox events for order (${outboxRows.rows.length} rows):`);
  for (const r of outboxRows.rows) {
    console.log(`  [${r.event_type}] status=${r.status}, attempts=${r.attempts}, publishedAt=${r.published_at}`);
  }
  const allPublished = outboxRows.rows.every((r) => r.status === 'PUBLISHED');

  const notifRows = await pool.query('SELECT * FROM notifications WHERE order_id = $1', [orderResult.id]);
  console.log(`Notifications count for order: ${notifRows.rows.length} (expected: 1)`);
  if (notifRows.rows.length > 0) {
    console.log(`  Message: "${notifRows.rows[0].message}"`);
  }

  const procRows = await pool.query('SELECT * FROM processed_events WHERE consumer_group = $1', ['notifications']);
  console.log(`Processed events count (notifications): ${procRows.rows.length} (expected: >= 1)`);

  if (!allPublished || notifRows.rows.length !== 1 || procRows.rows.length < 1) {
    throw new Error('Step (c) failed: Outbox rows not all PUBLISHED or notification count != 1');
  }
  console.log('-> Step (c) PASSED\n');

  // --------------------------------------------------------------------------
  // d) Test J: P01 search in Bengaluru present with stock 1 → Safe race → disappears ≤ 2s
  // --------------------------------------------------------------------------
  console.log('--- Step (d) [Test J]: OpenSearch Typo Search & Safe Race Sync ---');
  // 1. Search "bluetoth" with city=Bengaluru
  const searchBefore = await apiRequest('/api/search?q=bluetoth&city=Bengaluru');
  const hitsBefore = searchBefore.body.hits || [];
  const p01HitBefore = hitsBefore.find((h) => h.productId === p01Id || h.sku === 'SM-AUD-001');
  console.log(`Search 'bluetoth' in Bengaluru before race: found ${hitsBefore.length} hit(s), P01 present: ${Boolean(p01HitBefore)}`);

  // Search "bluetoth" with city=Mumbai (should exclude P01)
  const searchMumbai = await apiRequest('/api/search?q=bluetoth&city=Mumbai');
  const p01MumbaiHit = (searchMumbai.body.hits || []).find((h) => h.productId === p01Id || h.sku === 'SM-AUD-001');
  console.log(`Search 'bluetoth' in Mumbai: P01 present: ${Boolean(p01MumbaiHit)} (expected: false)`);

  if (!p01HitBefore || p01MumbaiHit) {
    throw new Error('Step (d) failed: Initial search did not show P01 in Bengaluru or mistakenly showed in Mumbai');
  }

  // 2. Safe race: 50 concurrent buyers
  console.log('Triggering Safe Race: 50 concurrent buyers on P01 (stock 1)...');
  const raceRes = await apiRequest('/api/demo/race', {
    method: 'POST',
    body: {
      productId: p01Id,
      storeId: blrStoreId,
      buyers: 50,
      mode: 'safe'
    }
  });
  console.log('Race summary:', raceRes.body.summary);
  const { success, failed, baselineQty, finalStock } = raceRes.body.summary;
  if (success !== 1 || failed !== 49 || baselineQty !== 1 || finalStock !== 0) {
    throw new Error(`Step (d) failed: Expected 1 success, 49 failed, baseline 1, final 0, got: ${JSON.stringify(raceRes.body.summary)}`);
  }

  // 3. Wait up to 2.5s for StoreStockChanged event to reach OpenSearch via search-indexer consumer
  console.log('Waiting 2 seconds for event pipeline to sync zero-stock to OpenSearch...');
  await sleep(2000);

  // 4. Re-search "bluetoth" with city=Bengaluru: P01 must disappear
  const searchAfter = await apiRequest('/api/search?q=bluetoth&city=Bengaluru');
  const p01HitAfter = (searchAfter.body.hits || []).find((h) => h.productId === p01Id || h.sku === 'SM-AUD-001');
  console.log(`Search 'bluetoth' in Bengaluru after race: P01 present: ${Boolean(p01HitAfter)} (expected: false)`);

  if (p01HitAfter) {
    throw new Error('Step (d) failed: P01 did not disappear from Bengaluru search results after stock reached 0');
  }
  console.log('-> Step (d) [Test J] PASSED\n');

  // --------------------------------------------------------------------------
  // e) POS sync: POST /api/pos/sale on P02 → stock 10 → 9, no notification, OpenSearch 9, reconciliation PASS
  // --------------------------------------------------------------------------
  console.log('--- Step (e): Physical Store POS Sale Sync ---');
  const p02StockBeforeRes = await pool.query(
    'SELECT stock_qty FROM inventory WHERE product_id = $1 AND store_id = $2',
    [p02Id, blrStoreId]
  );
  const p02StockBefore = Number(p02StockBeforeRes.rows[0].stock_qty);
  console.log(`P02 stock before POS sale: ${p02StockBefore}`);

  const notifCountBeforeRes = await pool.query('SELECT COUNT(*) FROM notifications');
  const notifCountBefore = Number(notifCountBeforeRes.rows[0].count);

  const posRes = await apiRequest('/api/pos/sale', {
    method: 'POST',
    body: {
      storeId: blrStoreId,
      items: [{ productId: p02Id, quantity: 1 }]
    }
  });
  console.log(`POST /api/pos/sale: status ${posRes.status}, order ${posRes.body.order.orderNumber}`);

  const p02StockAfterRes = await pool.query(
    'SELECT stock_qty FROM inventory WHERE product_id = $1 AND store_id = $2',
    [p02Id, blrStoreId]
  );
  const p02StockAfter = Number(p02StockAfterRes.rows[0].stock_qty);
  console.log(`P02 stock after POS sale: ${p02StockAfter} (expected: ${p02StockBefore - 1})`);

  const notifCountAfterRes = await pool.query('SELECT COUNT(*) FROM notifications');
  const notifCountAfter = Number(notifCountAfterRes.rows[0].count);
  console.log(`Total notifications before: ${notifCountBefore}, after: ${notifCountAfter} (expected: equal)`);

  if (p02StockAfter !== p02StockBefore - 1 || notifCountAfter !== notifCountBefore) {
    throw new Error('Step (e) failed: Stock did not decrement or a customer notification was emitted for POS');
  }

  console.log('Waiting 2 seconds for OpenSearch sync...');
  await sleep(2000);

  const metricsAfterPos = await apiRequest('/api/xray/metrics');
  const p02Recon = metricsAfterPos.body.reconciliation?.rows?.find((r) => r.productId === p02Id);
  console.log(`P02 OpenSearch reconciliation: status=${p02Recon?.status}, pgStock=${p02Recon?.pgStock}, osStock=${p02Recon?.osStock}`);

  if (p02Recon && p02Recon.status !== 'PASS') {
    throw new Error('Step (e) failed: Reconciliation status for P02 is not PASS');
  }
  console.log('-> Step (e) PASSED\n');

  // --------------------------------------------------------------------------
  // f) Test F: Redeliver same OrderPlaced event twice → still 1 notification, DUPLICATE_SKIPPED
  // --------------------------------------------------------------------------
  console.log('--- Step (f) [Test F]: Redeliver OrderPlaced Twice to Kafka ---');
  // Query the OrderPlaced event from earlier checkout
  const origEventRow = await pool.query(
    "SELECT event_id, aggregate_id, payload, created_at FROM outbox_events WHERE aggregate_id = $1 AND event_type = 'OrderPlaced'",
    [orderResult.id]
  );
  const origEvent = origEventRow.rows[0];

  const duplicateEnvelope = {
    schemaVersion: 1,
    eventId: origEvent.event_id,
    eventType: 'OrderPlaced',
    occurredAt: origEvent.created_at.toISOString(),
    ...origEvent.payload
  };

  let duplicateSkippedEmitted = false;
  // Listen via SSE on http://localhost:4000/api/orders/:id/events to receive server-side event
  const sseReq = http.get(`${BASE_URL}/api/orders/${orderResult.id}/events`, (res) => {
    let buffer = '';
    res.on('data', (chunk) => {
      buffer += chunk.toString();
      const lines = buffer.split('\n');
      buffer = lines.pop();
      let currentEvent = null;
      for (const line of lines) {
        if (line.startsWith('event: ')) {
          currentEvent = line.slice(7).trim();
        } else if (line.startsWith('data: ') && currentEvent === 'stage') {
          try {
            const data = JSON.parse(line.slice(6).trim());
            if (data.stage === 'DUPLICATE_SKIPPED') {
              duplicateSkippedEmitted = true;
            }
          } catch (e) {}
        }
      }
    });
  });

  // Give SSE connection 500ms to establish
  await sleep(500);

  const producer = await connectProducer();
  console.log(`Publishing duplicate OrderPlaced envelope (eventId: ${origEvent.event_id}) directly to Kafka...`);
  await producer.send({
    topic: TOPICS.OrderPlaced,
    messages: [{ key: String(origEvent.aggregate_id), value: JSON.stringify(duplicateEnvelope) }]
  });

  console.log('Waiting 3s for consumer deduplication and SSE DUPLICATE_SKIPPED...');
  await sleep(3000);
  sseReq.destroy();

  const finalNotifs = await pool.query('SELECT * FROM notifications WHERE order_id = $1', [orderResult.id]);
  console.log(`Notifications in DB for order after replay: ${finalNotifs.rows.length} (expected: exactly 1)`);
  console.log(`DUPLICATE_SKIPPED emitted on SSE: ${duplicateSkippedEmitted}`);

  if (finalNotifs.rows.length !== 1 || !duplicateSkippedEmitted) {
    throw new Error('Step (f) failed: Duplicate notification inserted or DUPLICATE_SKIPPED not emitted');
  }
  console.log('-> Step (f) [Test F] PASSED\n');

  // --------------------------------------------------------------------------
  // g) Test G / Chaos Self-Heal: enable 'relay-after-publish', order P03, row stays PROCESSING,
  //    lease expires (~10s) → relay reclaims, republishes, consumer dedups → still 1 notification, row becomes PUBLISHED
  // --------------------------------------------------------------------------
  console.log('--- Step (g) [Test G]: Chaos Self-Healing Recovery (relay-after-publish) ---');
  // 1. Enable chaos switch 'relay-after-publish'
  const chaosSetRes = await apiRequest('/api/admin/chaos', {
    method: 'POST',
    body: { target: 'relay-after-publish', enabled: true }
  });
  console.log('Enabled chaos:', chaosSetRes.body);

  // 2. Order P03
  const chaosOrderKey = randomUUID();
  const chaosOrderRes = await apiRequest('/api/checkout', {
    method: 'POST',
    headers: {
      'x-customer-id': c01Id,
      'idempotency-key': chaosOrderKey
    },
    body: {
      storeId: blrStoreId,
      items: [{ productId: p03Id, quantity: 1 }]
    }
  });
  const chaosOrderId = chaosOrderRes.body.order.id;
  console.log(`Ordered P03: order ${chaosOrderRes.body.order.orderNumber} (id: ${chaosOrderId})`);

  // 3. Wait 1.5s for relay to publish and trigger chaos switch (skip markOutboxPublished)
  await sleep(1500);

  const chaosOutboxRow = await pool.query(
    "SELECT id, status, claimed_at FROM outbox_events WHERE aggregate_id = $1 AND event_type = 'OrderPlaced'",
    [chaosOrderId]
  );
  const rowBefore = chaosOutboxRow.rows[0];
  console.log(`Outbox row state right after chaos publish: status=${rowBefore.status}, claimed_at=${rowBefore.claimed_at}`);

  if (rowBefore.status !== 'PROCESSING') {
    throw new Error(`Step (g) failed: Outbox row should be PROCESSING, got ${rowBefore.status}`);
  }

  // 4. Wait 11.5s for 10s lease to expire and relay loop to reclaim & republish
  console.log('Waiting 12 seconds for 10s lease expiry and automatic relay reclaim...');
  await sleep(12000);

  const chaosOutboxAfter = await pool.query(
    "SELECT id, status, published_at FROM outbox_events WHERE aggregate_id = $1 AND event_type = 'OrderPlaced'",
    [chaosOrderId]
  );
  const rowAfter = chaosOutboxAfter.rows[0];
  console.log(`Outbox row state after lease expiry & reclaim: status=${rowAfter.status}, published_at=${rowAfter.published_at}`);

  const chaosNotifs = await pool.query('SELECT * FROM notifications WHERE order_id = $1', [chaosOrderId]);
  console.log(`Notifications in DB for chaos order: ${chaosNotifs.rows.length} (expected: exactly 1)`);

  if (rowAfter.status !== 'PUBLISHED' || chaosNotifs.rows.length !== 1) {
    throw new Error('Step (g) failed: Row did not recover to PUBLISHED or duplicate notification was created');
  }
  console.log('-> Step (g) [Test G] PASSED\n');

  // --------------------------------------------------------------------------
  // h) Final: Reset demo, 10/10 invariants PASS, /health all 3 'up'
  // --------------------------------------------------------------------------
  console.log('--- Step (h): Final Reset & Health Check ---');
  const finalReset = await apiRequest('/api/demo/reset', { method: 'POST' });
  console.log(`Final reset completed in ${finalReset.body.durationMs}ms`);

  const finalMetrics = await apiRequest('/api/xray/metrics');
  const finalChecks = finalMetrics.body.consistency.checks;
  const finalPass = finalChecks.filter((c) => c.status === 'PASS').length;
  console.log(`Final consistency: ${finalPass}/10 checks PASS`);

  const healthRes = await apiRequest('/health');
  console.log('GET /health:', healthRes.body);

  const isHealthy =
    healthRes.body.pg === 'up' &&
    healthRes.body.kafka === 'up' &&
    healthRes.body.opensearch === 'up';

  if (finalPass !== 10 || !isHealthy) {
    throw new Error('Step (h) failed: Consistency != 10 or health not all up');
  }
  console.log('-> Step (h) PASSED\n');

  console.log('================================================================');
  console.log('  ALL INTEGRATION ACCEPTANCE TESTS (F, G, J, Pipeline) PASSED!  ');
  console.log('================================================================');
}

if (require.main === module) {
  runPipelineVerification()
    .then(async () => {
      await disconnectAll();
      pool.end();
      process.exit(0);
    })
    .catch(async (err) => {
      console.error('\n*** PIPELINE VERIFICATION FAILED ***');
      console.error(err);
      await disconnectAll();
      pool.end();
      process.exit(1);
    });
}

module.exports = { runPipelineVerification };
