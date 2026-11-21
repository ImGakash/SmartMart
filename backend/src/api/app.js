const express = require('express');
const cors = require('cors');
const db = require('../db');

const catalogRouter = require('./routes/catalog');
const cartRouter = require('./routes/cart');
const checkoutRouter = require('./routes/checkout');
const xrayRouter = require('./routes/xray');
const demoRouter = require('./routes/demo');
const adminRouter = require('./routes/admin');

const app = express();

// Standard middlewares
app.use(cors());
app.use(express.json());

// Root GET /health mounted directly outside /api per CONTRACT.md §10
app.get('/health', async (req, res) => {
  let pgStatus = 'down';
  try {
    await db.pool.query('SELECT 1');
    pgStatus = 'up';
  } catch (err) {
    pgStatus = 'down';
  }

  // Pipeline not built yet honestly reported per prompt
  res.json({
    pg: pgStatus,
    kafka: 'down',
    opensearch: 'down'
  });
});

// Mount /api router
const apiRouter = express.Router();
apiRouter.use(catalogRouter);
apiRouter.use(cartRouter);
apiRouter.use(checkoutRouter);
apiRouter.use(xrayRouter);
apiRouter.use(demoRouter);
apiRouter.use(adminRouter);

app.use('/api', apiRouter);

// Central error handler mapping DbError codes per CONTRACT.md §2
app.use((err, req, res, next) => {
  if (err.name === 'DbError' || err.code) {
    if (err.code === 'INSUFFICIENT_STOCK') {
      return res.status(409).json({
        error: { code: err.code, message: err.message, details: err.details || {} }
      });
    }
    if (
      err.code === 'PRODUCT_NOT_FOUND' ||
      err.code === 'STORE_NOT_FOUND' ||
      err.code === 'CUSTOMER_NOT_FOUND' ||
      err.code === 'ORDER_NOT_FOUND'
    ) {
      return res.status(404).json({
        error: { code: err.code, message: err.message, details: err.details || {} }
      });
    }
    if (err.code === 'CART_EMPTY' || err.code === 'INVALID_QUANTITY') {
      return res.status(400).json({
        error: { code: err.code, message: err.message, details: err.details || {} }
      });
    }
  }

  const statusCode = err.status || err.statusCode || 500;
  res.status(statusCode).json({
    error: {
      code: err.code || 'INTERNAL_ERROR',
      message: err.message || 'An internal error occurred',
      details: err.details || {}
    }
  });
});

module.exports = app;
