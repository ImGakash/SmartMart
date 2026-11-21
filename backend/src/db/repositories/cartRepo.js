const { pool, DbError } = require('../pool');

async function getCart(customerId, storeId) {
  const cartRes = await pool.query(
    `INSERT INTO carts (customer_id, store_id, status)
     VALUES ($1, $2, 'ACTIVE')
     ON CONFLICT (customer_id, store_id) WHERE status = 'ACTIVE'
     DO UPDATE SET updated_at = now()
     RETURNING id, customer_id AS "customerId", store_id AS "storeId", status`,
    [customerId, storeId]
  );
  const cart = cartRes.rows[0];

  const itemsRes = await pool.query(
    `SELECT ci.product_id AS "productId", p.name, p.image_url AS "imageUrl",
            p.price_paise AS "unitPricePaise", ci.quantity,
            (p.price_paise * ci.quantity) AS "subtotalPaise",
            COALESCE(i.stock_qty, 0) AS "stockQty"
     FROM cart_items ci
     JOIN products p ON p.id = ci.product_id
     LEFT JOIN inventory i ON i.product_id = ci.product_id AND i.store_id = $2
     WHERE ci.cart_id = $1
     ORDER BY p.name`,
    [cart.id, storeId]
  );

  let totalPaise = 0;
  const items = itemsRes.rows.map((r) => {
    const subtotal = Number(r.subtotalPaise);
    totalPaise += subtotal;
    return {
      productId: r.productId,
      name: r.name,
      imageUrl: r.imageUrl,
      unitPricePaise: Number(r.unitPricePaise),
      quantity: Number(r.quantity),
      subtotalPaise: subtotal,
      stockQty: Number(r.stockQty)
    };
  });

  return {
    id: cart.id,
    customerId: cart.customerId,
    storeId: cart.storeId,
    status: cart.status,
    totalPaise,
    items
  };
}

async function addCartItem(cartId, productId, quantity) {
  if (!Number.isInteger(quantity) || quantity <= 0) {
    throw new DbError('INVALID_QUANTITY', { productId, quantity });
  }

  const cartRes = await pool.query(
    'SELECT id, customer_id AS "customerId", store_id AS "storeId", status FROM carts WHERE id = $1',
    [cartId]
  );
  if (cartRes.rows.length === 0) {
    throw new DbError('CART_EMPTY', { id: cartId });
  }
  const cart = cartRes.rows[0];

  const curItemRes = await pool.query(
    'SELECT quantity FROM cart_items WHERE cart_id = $1 AND product_id = $2',
    [cartId, productId]
  );
  const existingQty = curItemRes.rows.length > 0 ? Number(curItemRes.rows[0].quantity) : 0;

  const invRes = await pool.query(
    'SELECT stock_qty AS "stockQty" FROM inventory WHERE store_id = $1 AND product_id = $2',
    [cart.storeId, productId]
  );
  const stock = invRes.rows.length > 0 ? Number(invRes.rows[0].stockQty) : 0;

  if (existingQty + quantity > stock) {
    throw new DbError('INSUFFICIENT_STOCK', {
      productId,
      storeId: cart.storeId,
      available: stock,
      requested: existingQty + quantity
    });
  }

  await pool.query(
    `INSERT INTO cart_items (cart_id, product_id, quantity)
     VALUES ($1, $2, $3)
     ON CONFLICT (cart_id, product_id)
     DO UPDATE SET quantity = cart_items.quantity + EXCLUDED.quantity, updated_at = now()`,
    [cartId, productId, quantity]
  );

  return await getCart(cart.customerId, cart.storeId);
}

async function updateCartItem(cartId, productId, quantity) {
  if (!Number.isInteger(quantity) || quantity <= 0) {
    throw new DbError('INVALID_QUANTITY', { productId, quantity });
  }

  const cartRes = await pool.query(
    'SELECT id, customer_id AS "customerId", store_id AS "storeId" FROM carts WHERE id = $1',
    [cartId]
  );
  if (cartRes.rows.length === 0) {
    throw new DbError('CART_EMPTY', { id: cartId });
  }
  const cart = cartRes.rows[0];

  const invRes = await pool.query(
    'SELECT stock_qty AS "stockQty" FROM inventory WHERE store_id = $1 AND product_id = $2',
    [cart.storeId, productId]
  );
  const stock = invRes.rows.length > 0 ? Number(invRes.rows[0].stockQty) : 0;

  if (quantity > stock) {
    throw new DbError('INSUFFICIENT_STOCK', {
      productId,
      storeId: cart.storeId,
      available: stock,
      requested: quantity
    });
  }

  await pool.query(
    'UPDATE cart_items SET quantity = $3, updated_at = now() WHERE cart_id = $1 AND product_id = $2',
    [cartId, productId, quantity]
  );

  return await getCart(cart.customerId, cart.storeId);
}

async function removeCartItem(cartId, productId) {
  const cartRes = await pool.query(
    'SELECT id, customer_id AS "customerId", store_id AS "storeId" FROM carts WHERE id = $1',
    [cartId]
  );
  if (cartRes.rows.length === 0) {
    throw new DbError('CART_EMPTY', { id: cartId });
  }
  const cart = cartRes.rows[0];

  await pool.query(
    'DELETE FROM cart_items WHERE cart_id = $1 AND product_id = $2',
    [cartId, productId]
  );

  return await getCart(cart.customerId, cart.storeId);
}

async function closeCart(tx, cartId) {
  const client = tx || pool;
  await client.query(
    "UPDATE carts SET status = 'CHECKED_OUT', updated_at = now() WHERE id = $1",
    [cartId]
  );
}

module.exports = {
  getCart,
  addCartItem,
  updateCartItem,
  removeCartItem,
  closeCart
};
