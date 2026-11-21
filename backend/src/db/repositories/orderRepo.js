const { pool, withTransaction, DbError } = require('../pool');
const { insertOutboxEvent } = require('./outboxRepo');
const { deductInventory } = require('./productRepo');
const { closeCart } = require('./cartRepo');

async function placeOrderAtomic({ customerId, storeId, items, idempotencyKey, cartId = null }) {
  if (!items || items.length === 0) {
    throw new DbError('CART_EMPTY');
  }
  for (const item of items) {
    if (!Number.isInteger(item.quantity) || item.quantity <= 0) {
      throw new DbError('INVALID_QUANTITY', { productId: item.productId, quantity: item.quantity });
    }
  }

  return await withTransaction(async (tx) => {
    // Validate store
    const storeRes = await tx.query('SELECT id, store_code AS "storeCode", city FROM stores WHERE id = $1', [storeId]);
    if (storeRes.rows.length === 0) {
      throw new DbError('STORE_NOT_FOUND', { id: storeId });
    }
    // Validate customer
    const custRes = await tx.query('SELECT id, name, email FROM customers WHERE id = $1', [customerId]);
    if (custRes.rows.length === 0) {
      throw new DbError('CUSTOMER_NOT_FOUND', { id: customerId });
    }

    // Authoritative prices
    const productIds = items.map((i) => i.productId);
    const prodRes = await tx.query(
      'SELECT id, price_paise AS "pricePaise" FROM products WHERE id = ANY($1)',
      [productIds]
    );
    const priceMap = new Map();
    for (const r of prodRes.rows) {
      priceMap.set(r.id, Number(r.pricePaise));
    }
    for (const id of productIds) {
      if (!priceMap.has(id)) {
        throw new DbError('PRODUCT_NOT_FOUND', { id });
      }
    }

    let totalPaise = 0;
    for (const item of items) {
      totalPaise += priceMap.get(item.productId) * item.quantity;
    }

    // Insert-first idempotency
    const orderInsertSql = `
      INSERT INTO orders (customer_id, store_id, source, total_paise, idempotency_key)
      VALUES ($1, $2, 'ONLINE', $3, $4)
      ON CONFLICT (idempotency_key) DO NOTHING
      RETURNING id, order_number AS "orderNumber", customer_id AS "customerId", store_id AS "storeId",
                source, status, total_paise AS "totalPaise", idempotency_key AS "idempotencyKey", created_at AS "createdAt";
    `;
    const orderRes = await tx.query(orderInsertSql, [customerId, storeId, totalPaise, idempotencyKey]);

    if (orderRes.rows.length === 0) {
      // Replay
      const existingRes = await tx.query(
        `SELECT id, order_number AS "orderNumber", customer_id AS "customerId", store_id AS "storeId",
                source, status, total_paise AS "totalPaise", idempotency_key AS "idempotencyKey", created_at AS "createdAt"
         FROM orders WHERE idempotency_key = $1`,
        [idempotencyKey]
      );
      const existing = existingRes.rows[0];
      const itemsRes = await tx.query(
        `SELECT product_id AS "productId", store_id AS "storeId", quantity, unit_price_paise AS "unitPricePaise", subtotal_paise AS "subtotalPaise"
         FROM order_items WHERE order_id = $1`,
        [existing.id]
      );
      existing.items = itemsRes.rows.map((r) => ({
        ...r,
        quantity: Number(r.quantity),
        unitPricePaise: Number(r.unitPricePaise),
        subtotalPaise: Number(r.subtotalPaise)
      }));
      existing.totalPaise = Number(existing.totalPaise);
      existing.createdAt = existing.createdAt instanceof Date ? existing.createdAt.toISOString() : existing.createdAt;
      return { order: existing, replayed: true };
    }

    const order = orderRes.rows[0];
    order.totalPaise = Number(order.totalPaise);
    order.createdAt = order.createdAt instanceof Date ? order.createdAt.toISOString() : order.createdAt;

    // Deadlock avoidance: sort items by productId asc
    const sortedItems = [...items].sort((a, b) => a.productId.localeCompare(b.productId));

    for (const item of sortedItems) {
      await deductInventory(tx, storeId, item.productId, item.quantity);
    }

    // Insert order items
    order.items = [];
    for (const item of sortedItems) {
      const unitPricePaise = priceMap.get(item.productId);
      const subtotalPaise = unitPricePaise * item.quantity;
      await tx.query(
        `INSERT INTO order_items (order_id, product_id, store_id, quantity, unit_price_paise, subtotal_paise)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [order.id, item.productId, storeId, item.quantity, unitPricePaise, subtotalPaise]
      );
      order.items.push({
        productId: item.productId,
        storeId,
        quantity: item.quantity,
        unitPricePaise,
        subtotalPaise
      });
    }

    // Step 9: If cartId: closeCart(tx, cartId)
    if (cartId) {
      await closeCart(tx, cartId);
    }

    // Outbox: 1 x OrderPlaced + 1 x StoreStockChanged per item
    const customer = custRes.rows[0];
    await insertOutboxEvent(tx, {
      eventType: 'OrderPlaced',
      aggregateType: 'ORDER',
      aggregateId: order.id,
      payload: {
        orderId: order.id,
        orderNumber: order.orderNumber,
        source: 'ONLINE',
        storeId,
        customer: {
          id: customer.id,
          name: customer.name,
          email: customer.email
        },
        items: order.items.map((i) => ({
          productId: i.productId,
          quantity: i.quantity,
          unitPricePaise: i.unitPricePaise
        })),
        totalPaise
      }
    });

    for (const item of order.items) {
      await insertOutboxEvent(tx, {
        eventType: 'StoreStockChanged',
        aggregateType: 'PRODUCT',
        aggregateId: item.productId,
        payload: {
          productId: item.productId,
          storeId,
          qtySold: item.quantity,
          source: 'ONLINE',
          orderId: order.id
        }
      });
    }

    return { order, replayed: false };
  });
}

async function recordPosSale({ storeId, items, idempotencyKey }) {
  if (!items || items.length === 0) {
    throw new DbError('CART_EMPTY');
  }
  for (const item of items) {
    if (!Number.isInteger(item.quantity) || item.quantity <= 0) {
      throw new DbError('INVALID_QUANTITY', { productId: item.productId, quantity: item.quantity });
    }
  }

  return await withTransaction(async (tx) => {
    // Validate store
    const storeRes = await tx.query('SELECT id, store_code AS "storeCode", city FROM stores WHERE id = $1', [storeId]);
    if (storeRes.rows.length === 0) {
      throw new DbError('STORE_NOT_FOUND', { id: storeId });
    }

    // Authoritative prices
    const productIds = items.map((i) => i.productId);
    const prodRes = await tx.query(
      'SELECT id, price_paise AS "pricePaise" FROM products WHERE id = ANY($1)',
      [productIds]
    );
    const priceMap = new Map();
    for (const r of prodRes.rows) {
      priceMap.set(r.id, Number(r.pricePaise));
    }
    for (const id of productIds) {
      if (!priceMap.has(id)) {
        throw new DbError('PRODUCT_NOT_FOUND', { id });
      }
    }

    let totalPaise = 0;
    for (const item of items) {
      totalPaise += priceMap.get(item.productId) * item.quantity;
    }

    // Insert-first idempotency for POS_STORE
    const orderInsertSql = `
      INSERT INTO orders (customer_id, store_id, source, total_paise, idempotency_key)
      VALUES (NULL, $1, 'POS_STORE', $2, $3)
      ON CONFLICT (idempotency_key) DO NOTHING
      RETURNING id, order_number AS "orderNumber", customer_id AS "customerId", store_id AS "storeId",
                source, status, total_paise AS "totalPaise", idempotency_key AS "idempotencyKey", created_at AS "createdAt";
    `;
    const orderRes = await tx.query(orderInsertSql, [storeId, totalPaise, idempotencyKey]);

    if (orderRes.rows.length === 0) {
      const existingRes = await tx.query(
        `SELECT id, order_number AS "orderNumber", customer_id AS "customerId", store_id AS "storeId",
                source, status, total_paise AS "totalPaise", idempotency_key AS "idempotencyKey", created_at AS "createdAt"
         FROM orders WHERE idempotency_key = $1`,
        [idempotencyKey]
      );
      const existing = existingRes.rows[0];
      const itemsRes = await tx.query(
        `SELECT product_id AS "productId", store_id AS "storeId", quantity, unit_price_paise AS "unitPricePaise", subtotal_paise AS "subtotalPaise"
         FROM order_items WHERE order_id = $1`,
        [existing.id]
      );
      existing.items = itemsRes.rows.map((r) => ({
        ...r,
        quantity: Number(r.quantity),
        unitPricePaise: Number(r.unitPricePaise),
        subtotalPaise: Number(r.subtotalPaise)
      }));
      existing.totalPaise = Number(existing.totalPaise);
      existing.createdAt = existing.createdAt instanceof Date ? existing.createdAt.toISOString() : existing.createdAt;
      return { order: existing, replayed: true };
    }

    const order = orderRes.rows[0];
    order.totalPaise = Number(order.totalPaise);
    order.createdAt = order.createdAt instanceof Date ? order.createdAt.toISOString() : order.createdAt;

    const sortedItems = [...items].sort((a, b) => a.productId.localeCompare(b.productId));

    for (const item of sortedItems) {
      await deductInventory(tx, storeId, item.productId, item.quantity);
    }

    order.items = [];
    for (const item of sortedItems) {
      const unitPricePaise = priceMap.get(item.productId);
      const subtotalPaise = unitPricePaise * item.quantity;
      await tx.query(
        `INSERT INTO order_items (order_id, product_id, store_id, quantity, unit_price_paise, subtotal_paise)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [order.id, item.productId, storeId, item.quantity, unitPricePaise, subtotalPaise]
      );
      order.items.push({
        productId: item.productId,
        storeId,
        quantity: item.quantity,
        unitPricePaise,
        subtotalPaise
      });
    }

    // POS emits only StoreStockChanged per item
    for (const item of order.items) {
      await insertOutboxEvent(tx, {
        eventType: 'StoreStockChanged',
        aggregateType: 'PRODUCT',
        aggregateId: item.productId,
        payload: {
          productId: item.productId,
          storeId,
          qtySold: item.quantity,
          source: 'POS_STORE',
          orderId: order.id
        }
      });
    }

    return { order, replayed: false };
  });
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

async function getOrderByIdempotencyKey(key) {
  const orderRes = await pool.query(
    `SELECT o.id, o.order_number AS "orderNumber", o.customer_id AS "customerId", o.store_id AS "storeId",
            o.source, o.status, o.total_paise AS "totalPaise", o.idempotency_key AS "idempotencyKey", o.created_at AS "createdAt",
            c.name AS "customerName", c.email AS "customerEmail",
            s.store_code AS "storeCode", s.city AS "storeCity"
     FROM orders o
     LEFT JOIN customers c ON c.id = o.customer_id
     JOIN stores s ON s.id = o.store_id
     WHERE o.idempotency_key = $1`,
    [key]
  );
  if (orderRes.rows.length === 0) {
    return null;
  }
  const row = orderRes.rows[0];
  const itemsRes = await pool.query(
    `SELECT product_id AS "productId", store_id AS "storeId", quantity, unit_price_paise AS "unitPricePaise", subtotal_paise AS "subtotalPaise"
     FROM order_items WHERE order_id = $1`,
    [row.id]
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

async function getRecentOrders(limit = 10) {
  const sql = `
    SELECT o.id, o.order_number AS "orderNumber", o.source, o.status, o.total_paise AS "totalPaise",
           s.city AS "storeCity",
           COALESCE(SUM(oi.quantity), 0)::integer AS "itemCount",
           o.created_at AS "createdAt"
    FROM orders o
    JOIN stores s ON s.id = o.store_id
    LEFT JOIN order_items oi ON oi.order_id = o.id
    GROUP BY o.id, o.order_number, o.source, o.status, o.total_paise, s.city, o.created_at
    ORDER BY o.created_at DESC
    LIMIT $1;
  `;
  const res = await pool.query(sql, [limit]);
  return res.rows.map((r) => ({
    id: r.id,
    orderNumber: r.orderNumber,
    source: r.source,
    status: r.status,
    totalPaise: Number(r.totalPaise),
    storeCity: r.storeCity,
    itemCount: Number(r.itemCount),
    createdAt: r.createdAt instanceof Date ? r.createdAt.toISOString() : r.createdAt
  }));
}

module.exports = {
  placeOrderAtomic,
  recordPosSale,
  getOrderById,
  getOrderByIdempotencyKey,
  getRecentOrders
};
