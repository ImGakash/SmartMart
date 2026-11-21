const express = require('express');
const router = express.Router();
const db = require('../../db');
const { getChaosState, setChaosSwitch } = require('../../events/chaos');
const { bulkIndexAll } = require('../../search/productIndex');

// GET /admin/chaos
router.get('/admin/chaos', (req, res) => {
  res.json(getChaosState());
});

// POST /admin/chaos
router.post('/admin/chaos', (req, res) => {
  const { target, enabled } = req.body;
  if (!target) {
    return res.status(400).json({ error: { code: 'INVALID_INPUT', message: 'target is required' } });
  }
  const result = setChaosSwitch(target, enabled);
  res.json(result);
});

// POST /admin/outbox/requeue
router.post('/admin/outbox/requeue', async (req, res, next) => {
  try {
    const requeued = await db.requeueFailedOutboxEvents();
    res.json({ requeued });
  } catch (err) {
    next(err);
  }
});

// POST /admin/reindex
router.post('/admin/reindex', async (req, res, next) => {
  try {
    const result = await bulkIndexAll();
    res.json(result);
  } catch (err) {
    next(err);
  }
});

module.exports = router;
