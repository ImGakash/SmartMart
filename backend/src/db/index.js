const { pool, DbError } = require('./pool');
const orderRepo = require('./repositories/orderRepo');
const outboxRepo = require('./repositories/outboxRepo');

async function getStores() {
  const res = await pool.query('SELECT id, store_code AS "storeCode", store_name AS "storeName", city, state FROM stores ORDER BY store_code');
  return res.rows;
}

async function getCustomers() {
  const res = await pool.query('SELECT id, name, email, city FROM customers ORDER BY email');
  return res.rows;
}

async function getProducts({ category, limit = 50, offset = 0 } = {}) {
  let query = 'SELECT id, sku, name, brand, category, price_paise AS "pricePaise", image_url AS "imageUrl" FROM products';
  const params = [];
  if (category) {
    params.push(category);
    query += ` WHERE category = $${params.length}`;
  }
  params.push(limit, offset);
  query += ` ORDER BY name LIMIT $${params.length - 1} OFFSET $${params.length}`;
  const res = await pool.query(query, params);
  return res.rows.map((r) => ({
    ...r,
    pricePaise: Number(r.pricePaise)
  }));
}

async function getProductById(productId) {
  const res = await pool.query(
    'SELECT id, sku, name, description, category, brand, price_paise AS "pricePaise", image_url AS "imageUrl", attributes FROM products WHERE id = $1',
    [productId]
  );
  if (res.rows.length === 0) {
    throw new DbError('PRODUCT_NOT_FOUND', { id: productId });
  }
  const product = res.rows[0];
  product.pricePaise = Number(product.pricePaise);

  const availRes = await pool.query(
    `SELECT i.store_id AS "storeId", s.store_code AS "storeCode", s.store_name AS "storeName", s.city, i.stock_qty AS "stockQty"
     FROM inventory i
     JOIN stores s ON s.id = i.store_id
     WHERE i.product_id = $1
     ORDER BY s.store_code`,
    [productId]
  );
  product.availability = availRes.rows.map((r) => ({
    ...r,
    stockQty: Number(r.stockQty)
  }));
  return product;
}

async function getInventory(storeId, productId) {
  const res = await pool.query(
    'SELECT store_id AS "storeId", product_id AS "productId", stock_qty AS "stockQty", updated_at AS "updatedAt" FROM inventory WHERE store_id = $1 AND product_id = $2',
    [storeId, productId]
  );
  if (res.rows.length === 0) return null;
  const row = res.rows[0];
  return {
    storeId: row.storeId,
    productId: row.productId,
    stockQty: Number(row.stockQty),
    updatedAt: row.updatedAt instanceof Date ? row.updatedAt.toISOString() : row.updatedAt
  };
}

async function getOrderById(orderId) {
  const orderRes = await pool.query(
    `SELECT o.id, o.order_number AS "orderNumber", o.customer_id AS "customerId", o.store_id AS "storeId",
            o.source, o.status, o.total_paise AS "totalPaise", o.idempotency_key AS "idempotencyKey", o.created_at AS "createdAt",
            c.name AS "customerName", c.email AS "customerEmail",
            s.store_code AS "storeCode", s.city AS "storeCity"
     FROM orders o
     LEFT JOIN customers c ON c.id = o.customer_id
     JOIN stores s ON s.id = o.store_id
     WHERE o.id = $1`,
    [orderId]
  );
  if (orderRes.rows.length === 0) {
    throw new DbError('ORDER_NOT_FOUND', { id: orderId });
  }
  const row = orderRes.rows[0];
  const itemsRes = await pool.query(
    `SELECT product_id AS "productId", store_id AS "storeId", quantity, unit_price_paise AS "unitPricePaise", subtotal_paise AS "subtotalPaise"
     FROM order_items WHERE order_id = $1`,
    [orderId]
  );
  return {
    id: row.id,
    orderNumber: row.orderNumber,
    customerId: row.customerId,
    storeId: row.storeId,
    source: row.source,
    status: row.status,
    totalPaise: Number(row.totalPaise),
    idempotencyKey: row.idempotencyKey,
    createdAt: row.createdAt instanceof Date ? row.createdAt.toISOString() : row.createdAt,
    customer: row.customerId ? { id: row.customerId, name: row.customerName, email: row.customerEmail } : null,
    store: { storeCode: row.storeCode, city: row.storeCity },
    items: itemsRes.rows.map((i) => ({
      ...i,
      quantity: Number(i.quantity),
      unitPricePaise: Number(i.unitPricePaise),
      subtotalPaise: Number(i.subtotalPaise)
    }))
  };
}

module.exports = {
  ...orderRepo,
  ...outboxRepo,
  getStores,
  getCustomers,
  getProducts,
  getProductById,
  getInventory,
  getOrderById,
  pool,
  DbError
};
