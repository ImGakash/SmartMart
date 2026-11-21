const express = require('express');
const router = express.Router();
const db = require('../../db');
const bus = require('../../events/bus');
const { getChaosState } = require('../../events/chaos');

async function buildMetricsBundle() {
  const [
    dashboard,
    inventoryByCity,
    lowStock,
    recentOrders,
    recentNotifications,
    outbox,
    consistency,
    allDocs
  ] = await Promise.all([
    db.getDashboardMetrics(),
    db.getInventoryByCity(),
    db.getLowStock(3),
    db.getRecentOrders(10),
    db.getRecentNotifications(10),
    db.getOutboxMetrics(),
    db.getConsistencyReport(),
    db.getAllProductSearchDocs()
  ]);

  const chaos = getChaosState();

  // v1.2 Reconciliation: honestly reported as MISSING while OpenSearch pipeline is not yet running
  const reconciliation = {
    checkedAt: new Date().toISOString(),
    mismatches: allDocs.length,
    rows: allDocs.map((doc) => ({
      productId: doc.productId,
      name: doc.name,
      pgTotalStock: doc.totalStock,
      osTotalStock: 0,
      pgCities: doc.cities,
      osCities: [],
      status: 'MISSING'
    }))
  };

  return {
    dashboard,
    inventoryByCity,
    lowStock,
    recentOrders,
    recentNotifications,
    outbox,
    consistency,
    chaos,
    reconciliation
  };
}

// GET /xray/metrics
router.get('/xray/metrics', async (req, res, next) => {
  try {
    const bundle = await buildMetricsBundle();
    res.json(bundle);
  } catch (err) {
    next(err);
  }
});

// GET /xray/stream (SSE)
router.get('/xray/stream', async (req, res) => {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders();

  const sendMetrics = async () => {
    try {
      const bundle = await buildMetricsBundle();
      res.write(`data: ${JSON.stringify(bundle)}\n\n`);
    } catch (e) {
      // ignore transient stream error
    }
  };

  await sendMetrics();
  const interval = setInterval(sendMetrics, 1000);

  req.on('close', () => {
    clearInterval(interval);
  });
});

// GET /orders/:id/events (SSE)
router.get('/orders/:id/events', async (req, res, next) => {
  const orderId = req.params.id;

  try {
    const order = await db.getOrderById(orderId);

    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.flushHeaders();

    // Initial stage event since order is in DB
    const committedEvent = {
      stage: 'COMMITTED',
      at: order.createdAt instanceof Date ? order.createdAt.toISOString() : order.createdAt,
      detail: { orderId: order.id, source: order.source }
    };
    res.write(`event: stage\ndata: ${JSON.stringify(committedEvent)}\n\n`);

    // Heartbeat every 15s per CONTRACT.md §11
    const heartbeat = setInterval(() => {
      res.write(': heartbeat\n\n');
    }, 15000);

    // Listen for live stage transitions from event bus
    const unsubscribe = bus.subscribeOrder(orderId, (data) => {
      res.write(`event: stage\ndata: ${JSON.stringify(data)}\n\n`);
    });

    req.on('close', () => {
      clearInterval(heartbeat);
      unsubscribe();
    });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
