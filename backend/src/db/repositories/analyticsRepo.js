const fs = require('fs');
const path = require('path');
const { pool, withTransaction } = require('../pool');
const { getOutboxMetrics } = require('./outboxRepo');

async function getDashboardMetrics() {
  const [
    prodRes,
    storeRes,
    orderRes,
    notifRes,
    lowStockRes,
    outbox
  ] = await Promise.all([
    pool.query('SELECT COUNT(*)::integer AS count FROM products'),
    pool.query('SELECT COUNT(*)::integer AS count FROM stores'),
    pool.query(`
      SELECT
        COUNT(*)::integer AS total,
        COUNT(*) FILTER (WHERE source = 'ONLINE')::integer AS online,
        COUNT(*) FILTER (WHERE source = 'POS_STORE')::integer AS pos
      FROM orders
    `),
    pool.query('SELECT COUNT(*)::integer AS count FROM notifications'),
    pool.query('SELECT COUNT(*)::integer AS count FROM inventory WHERE stock_qty <= 3'),
    getOutboxMetrics()
  ]);

  const orderCounts = orderRes.rows[0];

  return {
    totalProducts: Number(prodRes.rows[0].count),
    totalStores: Number(storeRes.rows[0].count),
    totalOrders: Number(orderCounts.total),
    ordersBySource: {
      ONLINE: Number(orderCounts.online),
      POS_STORE: Number(orderCounts.pos)
    },
    totalNotifications: Number(notifRes.rows[0].count),
    lowStockCount: Number(lowStockRes.rows[0].count),
    outbox
  };
}

async function getInventoryByCity() {
  const sql = `
    SELECT s.city,
           COUNT(DISTINCT s.id)::integer AS "storeCount",
           COALESCE(SUM(i.stock_qty), 0)::integer AS "totalUnits",
           COUNT(DISTINCT CASE WHEN i.stock_qty = 0 THEN i.product_id END)::integer AS "outOfStockSkus"
    FROM stores s
    LEFT JOIN inventory i ON i.store_id = s.id
    GROUP BY s.city
    ORDER BY s.city;
  `;
  const res = await pool.query(sql);
  return res.rows.map((r) => ({
    city: r.city,
    storeCount: Number(r.storeCount),
    totalUnits: Number(r.totalUnits),
    outOfStockSkus: Number(r.outOfStockSkus)
  }));
}

async function getLowStock(threshold = 3) {
  const sql = `
    SELECT i.product_id AS "productId", p.name, s.store_code AS "storeCode", s.city, i.stock_qty AS "stockQty"
    FROM inventory i
    JOIN products p ON p.id = i.product_id
    JOIN stores s ON s.id = i.store_id
    WHERE i.stock_qty <= $1
    ORDER BY i.stock_qty ASC, p.name ASC;
  `;
  const res = await pool.query(sql, [threshold]);
  return res.rows.map((r) => ({
    productId: r.productId,
    name: r.name,
    storeCode: r.storeCode,
    city: r.city,
    stockQty: Number(r.stockQty)
  }));
}

async function getRaceState(productId, storeId) {
  const sql = `
    SELECT
      COALESCE((SELECT baseline_qty FROM inventory_baseline WHERE store_id = $1 AND product_id = $2), 0)::integer AS "baselineQty",
      COALESCE((SELECT stock_qty FROM inventory WHERE store_id = $1 AND product_id = $2), 0)::integer AS "currentQty",
      COALESCE((
        SELECT COUNT(DISTINCT o.id)::integer
        FROM orders o
        JOIN order_items oi ON oi.order_id = o.id
        WHERE o.store_id = $1 AND oi.product_id = $2 AND o.status = 'CONFIRMED'
      ), 0)::integer AS "successfulOrders",
      COALESCE((
        SELECT SUM(oi.quantity)::integer
        FROM order_items oi
        JOIN orders o ON o.id = oi.order_id
        WHERE o.store_id = $1 AND oi.product_id = $2 AND o.status = 'CONFIRMED'
      ), 0)::integer AS "unitsSold";
  `;
  const res = await pool.query(sql, [storeId, productId]);
  const row = res.rows[0];
  return {
    baselineQty: Number(row.baselineQty),
    currentQty: Number(row.currentQty),
    successfulOrders: Number(row.successfulOrders),
    unitsSold: Number(row.unitsSold)
  };
}

async function setNaiveStock(productId, qty) {
  const sql = `
    INSERT INTO inventory_naive (product_id, stock_qty)
    VALUES ($1, $2)
    ON CONFLICT (product_id) DO UPDATE SET stock_qty = EXCLUDED.stock_qty
    RETURNING product_id AS "productId", stock_qty AS "stockQty";
  `;
  const res = await pool.query(sql, [productId, qty]);
  return {
    productId: res.rows[0].productId,
    stockQty: Number(res.rows[0].stockQty)
  };
}

async function readNaiveStock(productId) {
  const res = await pool.query('SELECT stock_qty AS "stockQty" FROM inventory_naive WHERE product_id = $1', [productId]);
  if (res.rows.length === 0) return 0;
  return Number(res.rows[0].stockQty);
}

async function writeNaiveStockBlind(productId, newQty) {
  await pool.query('UPDATE inventory_naive SET stock_qty = $2 WHERE product_id = $1', [productId, newQty]);
}

async function getConsistencyReport() {
  const checks = [];

  // 1. no_negative_stock
  const negStock = await pool.query('SELECT store_id, product_id, stock_qty FROM inventory WHERE stock_qty < 0');
  checks.push({
    name: 'no_negative_stock',
    status: negStock.rows.length === 0 ? 'PASS' : 'FAIL',
    detail: negStock.rows.length === 0 ? 'Zero negative stock rows' : `${negStock.rows.length} rows with negative stock`
  });

  // 2. inventory_reconciliation
  const invRecon = await pool.query(`
    SELECT b.store_id, b.product_id
    FROM inventory_baseline b
    JOIN inventory i ON i.store_id = b.store_id AND i.product_id = b.product_id
    LEFT JOIN (
      SELECT oi.store_id, oi.product_id, SUM(oi.quantity) AS qty
      FROM order_items oi
      JOIN orders o ON o.id = oi.order_id
      WHERE o.status = 'CONFIRMED'
      GROUP BY 1, 2
    ) sold ON sold.store_id = b.store_id AND sold.product_id = b.product_id
    WHERE b.baseline_qty - COALESCE(sold.qty, 0) <> i.stock_qty;
  `);
  checks.push({
    name: 'inventory_reconciliation',
    status: invRecon.rows.length === 0 ? 'PASS' : 'FAIL',
    detail: invRecon.rows.length === 0 ? 'Baseline minus confirmed sold equals stock' : `${invRecon.rows.length} store-product mismatches`
  });

  // 3. order_totals_match
  const orderTotals = await pool.query(`
    SELECT o.id, o.order_number, o.total_paise, COALESCE(SUM(oi.subtotal_paise), 0) AS items_total
    FROM orders o
    LEFT JOIN order_items oi ON oi.order_id = o.id
    GROUP BY o.id, o.order_number, o.total_paise
    HAVING o.total_paise <> COALESCE(SUM(oi.subtotal_paise), 0)
  `);
  checks.push({
    name: 'order_totals_match',
    status: orderTotals.rows.length === 0 ? 'PASS' : 'FAIL',
    detail: orderTotals.rows.length === 0 ? 'Order total_paise matches sum of item subtotals' : `${orderTotals.rows.length} orders mismatch`
  });

  // 4. order_item_store_matches
  const itemStore = await pool.query(`
    SELECT oi.order_id, oi.product_id
    FROM order_items oi
    JOIN orders o ON o.id = oi.order_id
    WHERE oi.store_id <> o.store_id
  `);
  checks.push({
    name: 'order_item_store_matches',
    status: itemStore.rows.length === 0 ? 'PASS' : 'FAIL',
    detail: itemStore.rows.length === 0 ? 'All order items match order store_id' : `${itemStore.rows.length} mismatched store items`
  });

  // 5. outbox_order_orphans
  const outboxOrphans = await pool.query(`
    SELECT e.id, e.aggregate_id
    FROM outbox_events e
    LEFT JOIN orders o ON o.id = e.aggregate_id
    WHERE e.event_type = 'OrderPlaced' AND o.id IS NULL
  `);
  checks.push({
    name: 'outbox_order_orphans',
    status: outboxOrphans.rows.length === 0 ? 'PASS' : 'FAIL',
    detail: outboxOrphans.rows.length === 0 ? 'Zero orphan outbox order events' : `${outboxOrphans.rows.length} orphan events`
  });

  // 6. no_duplicate_notifications
  const dupNotifs = await pool.query(`
    SELECT order_id, channel, COUNT(*)
    FROM notifications
    GROUP BY order_id, channel
    HAVING COUNT(*) > 1
  `);
  checks.push({
    name: 'no_duplicate_notifications',
    status: dupNotifs.rows.length === 0 ? 'PASS' : 'FAIL',
    detail: dupNotifs.rows.length === 0 ? 'Zero duplicate notifications' : `${dupNotifs.rows.length} duplicates`
  });

  // 7. every_order_has_items
  const emptyOrders = await pool.query(`
    SELECT o.id, o.order_number
    FROM orders o
    LEFT JOIN order_items oi ON oi.order_id = o.id
    WHERE oi.order_id IS NULL
  `);
  checks.push({
    name: 'every_order_has_items',
    status: emptyOrders.rows.length === 0 ? 'PASS' : 'FAIL',
    detail: emptyOrders.rows.length === 0 ? 'Every order has at least 1 item' : `${emptyOrders.rows.length} empty orders`
  });

  // 8. no_orphan_order_items
  const orphanItems = await pool.query(`
    SELECT oi.order_id, oi.product_id
    FROM order_items oi
    LEFT JOIN orders o ON o.id = oi.order_id
    WHERE o.id IS NULL
  `);
  checks.push({
    name: 'no_orphan_order_items',
    status: orphanItems.rows.length === 0 ? 'PASS' : 'FAIL',
    detail: orphanItems.rows.length === 0 ? 'Zero orphan order items' : `${orphanItems.rows.length} orphan items`
  });

  // 9. outbox_drained (informational)
  const pendingOutbox = await pool.query(`
    SELECT COUNT(*)::integer AS count
    FROM outbox_events
    WHERE status IN ('PENDING', 'PROCESSING')
  `);
  const pendingCount = Number(pendingOutbox.rows[0].count);
  checks.push({
    name: 'outbox_drained',
    status: pendingCount === 0 ? 'PASS' : 'FAIL',
    detail: pendingCount === 0 ? 'All outbox events published' : `${pendingCount} events pending/processing`
  });

  // 10. idempotency_unique
  const dupIdempotency = await pool.query(`
    SELECT idempotency_key, COUNT(*)
    FROM orders
    GROUP BY idempotency_key
    HAVING COUNT(*) > 1
  `);
  checks.push({
    name: 'idempotency_unique',
    status: dupIdempotency.rows.length === 0 ? 'PASS' : 'FAIL',
    detail: dupIdempotency.rows.length === 0 ? 'Zero duplicate idempotency keys' : `${dupIdempotency.rows.length} duplicate keys`
  });

  return { checks };
}

async function resetDemo() {
  const startTime = Date.now();

  const jsonPath = path.resolve(__dirname, '../../../../shared/products.json');
  const products = JSON.parse(fs.readFileSync(jsonPath, 'utf8'));

  const STORES = [
    { id: '20000000-0000-4000-8000-000000000001', storeCode: 'BLR-01' },
    { id: '20000000-0000-4000-8000-000000000002', storeCode: 'BLR-02' },
    { id: '20000000-0000-4000-8000-000000000003', storeCode: 'MUM-01' },
    { id: '20000000-0000-4000-8000-000000000004', storeCode: 'DEL-01' },
    { id: '20000000-0000-4000-8000-000000000005', storeCode: 'HYD-01' },
    { id: '20000000-0000-4000-8000-000000000006', storeCode: 'CHE-01' }
  ];

  const P01_ID = '10000000-0000-4000-8000-000000000001';
  const P02_ID = '10000000-0000-4000-8000-000000000002';
  const P03_ID = '10000000-0000-4000-8000-000000000003';

  const invParams = [];
  const invValues = [];
  const naiveParams = [];
  const naiveValues = [];

  let invIdx = 1;
  let naiveIdx = 1;

  for (const p of products) {
    for (const s of STORES) {
      let stockQty = 0;
      if (p.id === P01_ID) {
        stockQty = s.storeCode === 'BLR-01' ? 1 : 0;
      } else if (p.id === P02_ID) {
        stockQty = s.storeCode === 'BLR-01' ? 10 : 3;
      } else if (p.id === P03_ID) {
        stockQty = s.storeCode === 'BLR-01' ? 8 : 4;
      } else {
        const seedNum = (parseInt(p.id.slice(-2), 10) + parseInt(s.storeCode.slice(-1), 10)) % 7;
        stockQty = seedNum === 0 ? 1 : seedNum * 3;
      }

      invValues.push(`($${invIdx}, $${invIdx + 1}, $${invIdx + 2})`);
      invParams.push(s.id, p.id, stockQty);
      invIdx += 3;
    }

    const naiveQty = p.id === P01_ID ? 1 : 10;
    naiveValues.push(`($${naiveIdx}, $${naiveIdx + 1})`);
    naiveParams.push(p.id, naiveQty);
    naiveIdx += 2;
  }

  await withTransaction(async (tx) => {
    // 1. Truncate dynamic tables
    await tx.query('TRUNCATE notifications, processed_events, outbox_events, order_items, orders, cart_items, carts RESTART IDENTITY CASCADE;');

    // 2. Batch restore inventory
    const invSql = `
      INSERT INTO inventory (store_id, product_id, stock_qty)
      VALUES ${invValues.join(', ')}
      ON CONFLICT (store_id, product_id) DO UPDATE SET stock_qty = EXCLUDED.stock_qty, updated_at = now();
    `;
    await tx.query(invSql, invParams);

    // 3. Batch restore inventory_baseline
    const baselineSql = `
      INSERT INTO inventory_baseline (store_id, product_id, baseline_qty)
      VALUES ${invValues.join(', ')}
      ON CONFLICT (store_id, product_id) DO UPDATE SET baseline_qty = EXCLUDED.baseline_qty, captured_at = now();
    `;
    await tx.query(baselineSql, invParams);

    // 4. Batch restore inventory_naive
    const naiveSql = `
      INSERT INTO inventory_naive (product_id, stock_qty)
      VALUES ${naiveValues.join(', ')}
      ON CONFLICT (product_id) DO UPDATE SET stock_qty = EXCLUDED.stock_qty;
    `;
    await tx.query(naiveSql, naiveParams);

    // 5. Reset sequence
    await tx.query("SELECT setval('order_number_seq', 1000, false);");
  });

  return { durationMs: Date.now() - startTime };
}

module.exports = {
  getDashboardMetrics,
  getInventoryByCity,
  getLowStock,
  getRaceState,
  setNaiveStock,
  readNaiveStock,
  getNaiveStock: readNaiveStock,
  writeNaiveStockBlind,
  getConsistencyReport,
  resetDemo
};
