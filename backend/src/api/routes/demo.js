const express = require('express');
const router = express.Router();
const { randomUUID } = require('crypto');
const db = require('../../db');
const { bulkIndexAll } = require('../../search/productIndex');

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

// POST /demo/race
router.post('/demo/race', async (req, res, next) => {
  try {
    const { productId, storeId, buyers = 50, mode = 'safe' } = req.body;
    if (!productId || !storeId) {
      return res.status(400).json({ error: { code: 'INVALID_INPUT', message: 'productId and storeId are required' } });
    }

    if (mode === 'safe') {
      const invBefore = await db.getInventory(storeId, productId);
      const baselineQty = invBefore ? invBefore.stockQty : 0;

      const requests = [];
      for (let i = 1; i <= buyers; i++) {
        const pad = String((i % 60) + 1).padStart(2, '0');
        const customerId = `30000000-0000-4000-8000-0000000000${pad}`;
        const idempotencyKey = randomUUID();

        requests.push(
          db.placeOrderAtomic({
            customerId,
            storeId,
            items: [{ productId, quantity: 1 }],
            idempotencyKey
          }).then(
            (r) => ({ customerId, status: 'SUCCESS', orderId: r.order.id }),
            (err) => ({ customerId, status: err.code === 'INSUFFICIENT_STOCK' ? 'INSUFFICIENT_STOCK' : 'FAILED', orderId: null })
          )
        );
      }

      const results = await Promise.all(requests);
      const successes = results.filter((r) => r.status === 'SUCCESS');
      const failures = results.filter((r) => r.status !== 'SUCCESS');

      const invAfter = await db.getInventory(storeId, productId);
      const finalStock = invAfter ? invAfter.stockQty : 0;

      return res.json({
        results,
        summary: {
          success: successes.length,
          failed: failures.length,
          baselineQty,
          finalStock
        }
      });
    }

    if (mode === 'naive') {
      const baselineQty = await db.readNaiveStock(productId);

      const tasks = [];
      for (let i = 1; i <= buyers; i++) {
        const pad = String((i % 60) + 1).padStart(2, '0');
        const customerId = `30000000-0000-4000-8000-0000000000${pad}`;

        tasks.push(
          (async () => {
            const current = await db.readNaiveStock(productId);
            await sleep(50); // 50ms JS delay injected per CONTRACT.md §12
            await db.writeNaiveStockBlind(productId, current - 1);
            return { customerId, status: 'SUCCESS', orderId: null };
          })()
        );
      }

      const results = await Promise.all(tasks);
      const finalStock = await db.readNaiveStock(productId);

      return res.json({
        results,
        summary: {
          success: buyers,
          failed: 0,
          baselineQty,
          finalStock
        }
      });
    }

    res.status(400).json({ error: { code: 'INVALID_MODE', message: "mode must be 'safe' or 'naive'" } });
  } catch (err) {
    next(err);
  }
});

// POST /demo/reset
router.post('/demo/reset', async (req, res, next) => {
  try {
    const result = await db.resetDemo();
    try {
      await bulkIndexAll();
    } catch (osErr) {
      console.warn('Warning: bulkIndexAll failed during demo reset:', osErr.message);
    }
    res.json(result);
  } catch (err) {
    next(err);
  }
});

module.exports = router;
