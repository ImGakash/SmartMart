const express = require('express');
const router = express.Router();
const db = require('../../db');

function getCustomerId(req) {
  return req.headers['x-customer-id'] || req.body.customerId || req.query.customerId;
}

// GET /cart
router.get('/cart', async (req, res, next) => {
  try {
    const customerId = getCustomerId(req);
    const storeId = req.query.storeId || req.headers['x-store-id'];
    if (!customerId) {
      throw new db.DbError('CUSTOMER_NOT_FOUND', { message: 'Missing X-Customer-Id header' });
    }
    if (!storeId) {
      throw new db.DbError('STORE_NOT_FOUND', { message: 'Missing storeId parameter' });
    }
    const cart = await db.getCart(customerId, storeId);
    res.json(cart);
  } catch (err) {
    next(err);
  }
});

// POST /cart/items
router.post('/cart/items', async (req, res, next) => {
  try {
    const customerId = getCustomerId(req);
    const { storeId, productId, quantity } = req.body;
    if (!customerId) {
      throw new db.DbError('CUSTOMER_NOT_FOUND', { message: 'Missing X-Customer-Id header' });
    }
    if (!storeId) {
      throw new db.DbError('STORE_NOT_FOUND', { message: 'Missing storeId' });
    }
    const cart = await db.getCart(customerId, storeId);
    const updated = await db.addCartItem(cart.id, productId, parseInt(quantity, 10));
    res.json(updated);
  } catch (err) {
    next(err);
  }
});

// PATCH /cart/items/:productId
router.patch('/cart/items/:productId', async (req, res, next) => {
  try {
    const customerId = getCustomerId(req);
    const productId = req.params.productId;
    const { storeId, quantity } = req.body;
    if (!customerId) {
      throw new db.DbError('CUSTOMER_NOT_FOUND', { message: 'Missing X-Customer-Id header' });
    }
    if (!storeId) {
      throw new db.DbError('STORE_NOT_FOUND', { message: 'Missing storeId' });
    }
    const cart = await db.getCart(customerId, storeId);
    const updated = await db.updateCartItem(cart.id, productId, parseInt(quantity, 10));
    res.json(updated);
  } catch (err) {
    next(err);
  }
});

// DELETE /cart/items/:productId
router.delete('/cart/items/:productId', async (req, res, next) => {
  try {
    const customerId = getCustomerId(req);
    const productId = req.params.productId;
    const storeId = req.query.storeId || req.body.storeId;
    if (!customerId) {
      throw new db.DbError('CUSTOMER_NOT_FOUND', { message: 'Missing X-Customer-Id header' });
    }
    if (!storeId) {
      throw new db.DbError('STORE_NOT_FOUND', { message: 'Missing storeId' });
    }
    const cart = await db.getCart(customerId, storeId);
    const updated = await db.removeCartItem(cart.id, productId);
    res.json(updated);
  } catch (err) {
    next(err);
  }
});

module.exports = router;
