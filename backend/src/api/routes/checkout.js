const express = require('express');
const router = express.Router();
const { randomUUID } = require('crypto');
const db = require('../../db');
const bus = require('../../events/bus');

// POST /checkout
router.post('/checkout', async (req, res, next) => {
  try {
    const customerId = req.headers['x-customer-id'] || req.body.customerId;
    const idempotencyKey = req.headers['idempotency-key'] || req.body.idempotencyKey;
    const { storeId, items } = req.body;

    if (!customerId) {
      throw new db.DbError('CUSTOMER_NOT_FOUND', { message: 'Missing X-Customer-Id header' });
    }
    if (!idempotencyKey) {
      return res.status(400).json({
        error: { code: 'INVALID_HEADER', message: 'Missing Idempotency-Key header' }
      });
    }
    if (!storeId) {
      throw new db.DbError('STORE_NOT_FOUND', { message: 'Missing storeId' });
    }

    let orderItems = items;
    let cartId = null;

    // If items omitted, load from active cart (§10)
    if (!orderItems || orderItems.length === 0) {
      const cart = await db.getCart(customerId, storeId);
      if (!cart.items || cart.items.length === 0) {
        throw new db.DbError('CART_EMPTY');
      }
      cartId = cart.id;
      orderItems = cart.items.map((i) => ({
        productId: i.productId,
        quantity: i.quantity
      }));
    }

    const result = await db.placeOrderAtomic({
      customerId,
      storeId,
      items: orderItems,
      idempotencyKey,
      cartId
    });

    // Emit COMMITTED stage to SSE bus
    bus.emit(`order:${result.order.id}`, {
      stage: 'COMMITTED',
      at: new Date().toISOString(),
      detail: { orderId: result.order.id, replayed: result.replayed }
    });

    const statusCode = result.replayed ? 200 : 201;
    res.status(statusCode).json(result);
  } catch (err) {
    next(err);
  }
});

// GET /orders/:id
router.get('/orders/:id', async (req, res, next) => {
  try {
    const order = await db.getOrderById(req.params.id);
    res.json(order);
  } catch (err) {
    next(err);
  }
});

// GET /orders/:id/notifications
router.get('/orders/:id/notifications', async (req, res, next) => {
  try {
    const notifs = await db.getNotifications(req.params.id);
    res.json(notifs);
  } catch (err) {
    next(err);
  }
});

// POST /pos/sale
router.post('/pos/sale', async (req, res, next) => {
  try {
    const { storeId, items } = req.body;
    const idempotencyKey = req.body.idempotencyKey || req.headers['idempotency-key'] || randomUUID();

    if (!storeId) {
      throw new db.DbError('STORE_NOT_FOUND', { message: 'Missing storeId' });
    }

    const result = await db.recordPosSale({
      storeId,
      items,
      idempotencyKey
    });

    res.status(201).json(result);
  } catch (err) {
    next(err);
  }
});

module.exports = router;
