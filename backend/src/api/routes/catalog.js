const express = require('express');
const router = express.Router();
const db = require('../../db');
const { searchProducts } = require('../../search/productIndex');

// GET /stores
router.get('/stores', async (req, res, next) => {
  try {
    const stores = await db.getStores();
    res.json(stores);
  } catch (err) {
    next(err);
  }
});

// GET /customers
router.get('/customers', async (req, res, next) => {
  try {
    const customers = await db.getCustomers();
    res.json(customers);
  } catch (err) {
    next(err);
  }
});

// GET /products
router.get('/products', async (req, res, next) => {
  try {
    const { category, limit, offset } = req.query;
    const products = await db.getProducts({
      category,
      limit: limit ? parseInt(limit, 10) : 50,
      offset: offset ? parseInt(offset, 10) : 0
    });
    res.json(products);
  } catch (err) {
    next(err);
  }
});

// GET /products/:id
router.get('/products/:id', async (req, res, next) => {
  try {
    const product = await db.getProductById(req.params.id);
    res.json(product);
  } catch (err) {
    next(err);
  }
});

// GET /search (OpenSearch fuzzy search + filters per CONTRACT.md §9)
router.get('/search', async (req, res) => {
  try {
    const { q, category, city, minPaise, maxPaise, limit } = req.query;
    const result = await searchProducts({ q, category, city, minPaise, maxPaise, limit });
    res.json(result);
  } catch (err) {
    console.error('OpenSearch search error:', err.message);
    res.status(503).json({
      error: {
        code: 'OPENSEARCH_UNAVAILABLE',
        message: 'Search indexer not yet active or degraded',
        details: { error: err.message }
      }
    });
  }
});

module.exports = router;
