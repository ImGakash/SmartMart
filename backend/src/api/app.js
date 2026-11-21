const express = require('express');
const cors = require('cors');
const db = require('../db');
const { kafkaHealthy } = require('../events/kafka');
const { osHealthy } = require('../search/client');

const catalogRouter = require('./routes/catalog');
const cartRouter = require('./routes/cart');
const checkoutRouter = require('./routes/checkout');
const xrayRouter = require('./routes/xray');
const demoRouter = require('./routes/demo');
const adminRouter = require('./routes/admin');

const app = express();

// Request logging middleware (method, path, status, duration — no body logging)
app.use((req, res, next) => {
  const start = Date.now();
  res.on('finish', () => {
    const duration = Date.now() - start;
    console.log(`[HTTP] ${req.method} ${req.originalUrl || req.url} ${res.statusCode} ${duration}ms`);
  });
  next();
});

// Dynamic CORS configuration
const rawAllowedOrigins = process.env.ALLOWED_ORIGINS;
const isProd = process.env.NODE_ENV === 'production';

let allowedOrigins;
if (rawAllowedOrigins && rawAllowedOrigins.trim()) {
  allowedOrigins = rawAllowedOrigins.split(',').map((o) => o.trim()).filter(Boolean);
} else {
  allowedOrigins = ['http://localhost:5173', 'http://localhost:4000'];
  if (isProd) {
    console.warn('⚠️  WARNING: ALLOWED_ORIGINS is not explicitly configured in production! Defaulting to localhost.');
  }
}

app.use(
  cors({
    origin: (origin, callback) => {
      // Allow requests with no origin (e.g. mobile apps, curl, server-to-server)
      if (!origin || allowedOrigins.includes(origin) || allowedOrigins.includes('*')) {
        return callback(null, true);
      }
      return callback(new Error(`CORS origin '${origin}' not allowed by ALLOWED_ORIGINS policy`));
    },
    credentials: true,
    exposedHeaders: ['X-Customer-Id', 'Idempotency-Key']
  })
);

app.use(express.json());

// Helper for probe timeout (3 seconds maximum per probe)
function probeWithTimeout(probeFn, ms = 3000) {
  return Promise.race([
    probeFn(),
    new Promise((_, reject) => setTimeout(() => reject(new Error('Probe timeout')), ms))
  ]);
}

// Root GET /health mounted directly outside /api per CONTRACT.md §10
app.get('/health', async (req, res) => {
  let pgStatus = 'down';
  try {
    await probeWithTimeout(() => db.pool.query('SELECT 1'), 3000);
    pgStatus = 'up';
  } catch (err) {
    pgStatus = 'down';
  }

  let kafkaStatus = 'down';
  try {
    const isKafkaUp = await probeWithTimeout(() => kafkaHealthy(), 3000);
    kafkaStatus = isKafkaUp ? 'up' : 'down';
  } catch (err) {
    kafkaStatus = 'down';
  }

  let opensearchStatus = 'down';
  try {
    const isOsUp = await probeWithTimeout(() => osHealthy(), 3000);
    opensearchStatus = isOsUp ? 'up' : 'down';
  } catch (err) {
    opensearchStatus = 'down';
  }

  // Never return 500 — report granular service health
  const allUp = pgStatus === 'up' && kafkaStatus === 'up' && opensearchStatus === 'up';
  res.json({
    status: allUp ? 'ok' : 'degraded',
    services: {
      pg: pgStatus,
      kafka: kafkaStatus,
      opensearch: opensearchStatus
    },
    pg: pgStatus,
    kafka: kafkaStatus,
    opensearch: opensearchStatus
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
  // In production, redact stack traces / internal error details
  res.status(statusCode).json({
    error: {
      code: err.code || 'INTERNAL_ERROR',
      message: err.message || 'An internal error occurred',
      details: isProd ? undefined : (err.details || {})
    }
  });
});

module.exports = app;
