const { pool, DbError } = require('../pool');

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
  getProductSearchDoc,
  getAllProductSearchDocs
};
