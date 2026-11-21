const express = require('express');
const router = express.Router();
const db = require('../../db');
const bus = require('../../events/bus');
const { getChaosState } = require('../../events/chaos');
const { getReconciliation } = require('../../search/productIndex');

async function buildMetricsBundle() {
  const [
    dashboard,
    inventoryByCity,
    lowStock,
    recentOrders,
    recentNotifications,
    outbox,
    consistency,
    allDocs,
    reconciliation
  ] = await Promise.all([
    db.getDashboardMetrics(),
    db.getInventoryByCity(),
    db.getLowStock(3),
    db.getRecentOrders(10),
    db.getRecentNotifications(10),
    db.getOutboxMetrics(),
    db.getConsistencyReport(),
    db.getAllProductSearchDocs(),
    getReconciliation()
  ]);

  const chaos = getChaosState();

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
  res.setHeader('Cache-Control', 'no-cache, no-transform');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no');
  res.flushHeaders();

  let isClosed = false;

  const sendMetrics = async () => {
    if (isClosed) return;
    try {
      const bundle = await buildMetricsBundle();
      if (!isClosed) {
        res.write(`data: ${JSON.stringify(bundle)}\n\n`);
      }
    } catch (e) {
      // ignore transient stream error
    }
  };

  await sendMetrics();
  const interval = setInterval(sendMetrics, 1000);

  // Heartbeat comment every 15s to keep proxy connections alive
  const heartbeat = setInterval(() => {
    if (!isClosed) {
      res.write(': heartbeat\n\n');
    }
  }, 15000);

  req.on('close', () => {
    isClosed = true;
    clearInterval(interval);
    clearInterval(heartbeat);
  });
});

// GET /orders/:id/events (SSE)
router.get('/orders/:id/events', async (req, res, next) => {
  const orderId = req.params.id;

  try {
    const order = await db.getOrderById(orderId);

    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache, no-transform');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no');
    res.flushHeaders();

    let isClosed = false;

    // Initial stage event since order is in DB
    const committedEvent = {
      stage: 'COMMITTED',
      at: order.createdAt instanceof Date ? order.createdAt.toISOString() : order.createdAt,
      detail: { orderId: order.id, source: order.source }
    };
    res.write(`event: stage\ndata: ${JSON.stringify(committedEvent)}\n\n`);

    // Heartbeat every 15s per CONTRACT.md §11
    const heartbeat = setInterval(() => {
      if (!isClosed) {
        res.write(': heartbeat\n\n');
      }
    }, 15000);

    // Listen for live stage transitions from event bus
    const unsubscribe = bus.subscribeOrder(orderId, (data) => {
      if (!isClosed) {
        res.write(`event: stage\ndata: ${JSON.stringify(data)}\n\n`);
      }
    });

    req.on('close', () => {
      isClosed = true;
      clearInterval(heartbeat);
      unsubscribe();
    });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
