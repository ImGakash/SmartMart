const { pool, withTransaction, DbError } = require('../pool');
const { insertOutboxEvent } = require('./outboxRepo');

async function deductInventory(tx, storeId, productId, quantity) {
  const sql = `
    UPDATE inventory
    SET stock_qty = stock_qty - $3, updated_at = now()
    WHERE store_id = $1 AND product_id = $2 AND stock_qty >= $3
    RETURNING stock_qty AS "stockQty";
  `;
  const res = await tx.query(sql, [storeId, productId, quantity]);
  if (res.rows.length === 0) {
    const availRes = await tx.query(
      'SELECT stock_qty AS "stockQty" FROM inventory WHERE store_id = $1 AND product_id = $2',
      [storeId, productId]
    );
    const available = availRes.rows.length > 0 ? Number(availRes.rows[0].stockQty) : 0;
    throw new DbError('INSUFFICIENT_STOCK', {
      productId,
      storeId,
      available,
      requested: quantity
    });
  }
  return { stockQty: Number(res.rows[0].stockQty) };
}

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

module.exports = {
  deductInventory,
  placeOrderAtomic,
  recordPosSale
};
