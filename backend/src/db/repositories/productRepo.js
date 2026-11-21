const { pool, DbError } = require('../pool');

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

async function getCityInventory(city, productId) {
  const res = await pool.query(
    `SELECT s.id AS "storeId", s.store_code AS "storeCode", s.store_name AS "storeName", s.city, COALESCE(i.stock_qty, 0) AS "stockQty"
     FROM stores s
     LEFT JOIN inventory i ON i.store_id = s.id AND i.product_id = $2
     WHERE s.city = $1
     ORDER BY s.store_code`,
    [city, productId]
  );
  return res.rows.map((r) => ({
    storeId: r.storeId,
    storeCode: r.storeCode,
    storeName: r.storeName,
    city: r.city,
    stockQty: Number(r.stockQty)
  }));
}

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

async function getProductSearchDoc(productId) {
  const pRes = await pool.query(
    'SELECT id, sku, name, description, category, brand, price_paise AS "pricePaise", image_url AS "imageUrl" FROM products WHERE id = $1',
    [productId]
  );
  if (pRes.rows.length === 0) {
    throw new DbError('PRODUCT_NOT_FOUND', { id: productId });
  }
  const p = pRes.rows[0];

  const invRes = await pool.query(
    `SELECT s.id AS "storeId", s.store_code AS "storeCode", s.city, COALESCE(i.stock_qty, 0) AS "stockQty"
     FROM stores s
     LEFT JOIN inventory i ON i.store_id = s.id AND i.product_id = $1
     ORDER BY s.store_code`,
    [productId]
  );

  const availability = invRes.rows.map((r) => ({
    storeId: r.storeId,
    storeCode: r.storeCode,
    city: r.city,
    stockQty: Number(r.stockQty)
  }));

  const citiesSet = new Set();
  let totalStock = 0;
  for (const a of availability) {
    totalStock += a.stockQty;
    if (a.stockQty > 0) {
      citiesSet.add(a.city);
    }
  }

  return {
    productId: p.id,
    sku: p.sku,
    name: p.name,
    description: p.description,
    category: p.category,
    brand: p.brand,
    pricePaise: Number(p.pricePaise),
    imageUrl: p.imageUrl,
    cities: Array.from(citiesSet),
    availability,
    totalStock,
    indexedAt: new Date().toISOString()
  };
}

async function getAllProductSearchDocs() {
  const pRes = await pool.query(
    'SELECT id, sku, name, description, category, brand, price_paise AS "pricePaise", image_url AS "imageUrl" FROM products ORDER BY id'
  );

  const invRes = await pool.query(
    `SELECT s.id AS "storeId", s.store_code AS "storeCode", s.city, i.product_id AS "productId", COALESCE(i.stock_qty, 0) AS "stockQty"
     FROM stores s
     CROSS JOIN products pr
     LEFT JOIN inventory i ON i.store_id = s.id AND i.product_id = pr.id
     ORDER BY pr.id, s.store_code`
  );

  const storeMap = new Map();
  for (const row of invRes.rows) {
    if (!storeMap.has(row.productId)) {
      storeMap.set(row.productId, []);
    }
    storeMap.get(row.productId).push({
      storeId: row.storeId,
      storeCode: row.storeCode,
      city: row.city,
      stockQty: Number(row.stockQty)
    });
  }

  return pRes.rows.map((p) => {
    const availability = storeMap.get(p.id) || [];
    const citiesSet = new Set();
    let totalStock = 0;
    for (const a of availability) {
      totalStock += a.stockQty;
      if (a.stockQty > 0) {
        citiesSet.add(a.city);
      }
    }
    return {
      productId: p.id,
      sku: p.sku,
      name: p.name,
      description: p.description,
      category: p.category,
      brand: p.brand,
      pricePaise: Number(p.pricePaise),
      imageUrl: p.imageUrl,
      cities: Array.from(citiesSet),
      availability,
      totalStock,
      indexedAt: new Date().toISOString()
    };
  });
}

module.exports = {
  getProducts,
  getProductById,
  getInventory,
  getCityInventory,
  deductInventory,
  getProductSearchDoc,
  getAllProductSearchDocs
};
