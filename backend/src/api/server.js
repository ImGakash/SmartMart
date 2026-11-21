const express = require('express');
const { placeOrderAtomic, recordPosSale, getStores, getCustomers, getProducts } = require('../db');
const { randomUUID } = require('crypto');

const app = express();
app.use(express.json());

// GET /stores
app.get('/stores', async (req, res) => {
  try {
    const stores = await getStores();
    res.json(stores);
  } catch (err) {
    res.status(500).json({ error: { code: err.code || 'INTERNAL_ERROR', message: err.message } });
  }
});

// GET /customers
app.get('/customers', async (req, res) => {
  try {
    const customers = await getCustomers();
    res.json(customers);
  } catch (err) {
    res.status(500).json({ error: { code: err.code || 'INTERNAL_ERROR', message: err.message } });
  }
});

// GET /products
app.get('/products', async (req, res) => {
  try {
    const products = await getProducts();
    res.json(products);
  } catch (err) {
    res.status(500).json({ error: { code: err.code || 'INTERNAL_ERROR', message: err.message } });
  }
});

// POST /checkout (online checkout)
app.post('/checkout', async (req, res) => {
  try {
    const customerId = req.headers['x-customer-id'] || req.body.customerId;
    const idempotencyKey = req.headers['idempotency-key'] || req.body.idempotencyKey || randomUUID();
    const { storeId, items } = req.body;

    const result = await placeOrderAtomic({
      customerId,
      storeId,
      items,
      idempotencyKey
    });

    const status = result.replayed ? 200 : 201;
    res.status(status).json(result);
  } catch (err) {
    if (err.code === 'INSUFFICIENT_STOCK') {
      return res.status(409).json({ error: { code: err.code, message: err.message, details: err.details } });
    }
    if (err.code === 'CART_EMPTY' || err.code === 'INVALID_QUANTITY') {
      return res.status(400).json({ error: { code: err.code, message: err.message, details: err.details } });
    }
    if (err.code === 'PRODUCT_NOT_FOUND' || err.code === 'STORE_NOT_FOUND' || err.code === 'CUSTOMER_NOT_FOUND') {
      return res.status(404).json({ error: { code: err.code, message: err.message, details: err.details } });
    }
    res.status(500).json({ error: { code: 'INTERNAL_ERROR', message: err.message } });
  }
});

// POST /pos/sale (POS terminal checkout)
app.post('/pos/sale', async (req, res) => {
  try {
    const { storeId, items } = req.body;
    const idempotencyKey = randomUUID();

    const result = await recordPosSale({
      storeId,
      items,
      idempotencyKey
    });

    res.status(201).json(result);
  } catch (err) {
    if (err.code === 'INSUFFICIENT_STOCK') {
      return res.status(409).json({ error: { code: err.code, message: err.message, details: err.details } });
    }
    res.status(500).json({ error: { code: 'INTERNAL_ERROR', message: err.message } });
  }
});

const PORT = process.env.PORT || 4000;
if (require.main === module) {
  app.listen(PORT, () => {
    console.log(`Backend server running on http://localhost:${PORT}`);
  });
}

module.exports = app;
