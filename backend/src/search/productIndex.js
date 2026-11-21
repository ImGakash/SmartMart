const { client } = require('./client');
const db = require('../db');

const INDEX_NAME = 'smartmart-products';

const INDEX_MAPPING = {
  mappings: {
    properties: {
      productId: { type: 'keyword' },
      sku: { type: 'keyword' },
      name: { type: 'text', boost: 3 },
      brand: { type: 'text', boost: 2 },
      description: { type: 'text' },
      category: { type: 'keyword' },
      cities: { type: 'keyword' },
      pricePaise: { type: 'long' },
      totalStock: { type: 'integer' },
      imageUrl: { type: 'keyword', index: false },
      indexedAt: { type: 'date' },
      availability: {
        type: 'nested',
        properties: {
          storeId: { type: 'keyword' },
          storeCode: { type: 'keyword' },
          city: { type: 'keyword' },
          stockQty: { type: 'integer' }
        }
      }
    }
  }
};

/**
 * Ensure the 'smartmart-products' index exists with proper mapping.
 */
async function ensureIndex() {
  const exists = await client.indices.exists({ index: INDEX_NAME });
  if (!exists.body) {
    await client.indices.create({
      index: INDEX_NAME,
      body: INDEX_MAPPING
    });
    console.log(`Created OpenSearch index '${INDEX_NAME}'`);
  }
}

/**
 * Bulk index all 36 product search docs from PostgreSQL into OpenSearch.
 */
async function bulkIndexAll() {
  await ensureIndex();
  const docs = await db.getAllProductSearchDocs();
  if (!docs || docs.length === 0) {
    return { indexed: 0 };
  }

  const operations = docs.flatMap((doc) => [
    { index: { _index: INDEX_NAME, _id: doc.productId } },
    {
      ...doc,
      indexedAt: new Date().toISOString()
    }
  ]);

  const bulkResponse = await client.bulk({ refresh: true, body: operations });
  if (bulkResponse.body.errors) {
    console.error('OpenSearch bulk index had errors:', bulkResponse.body.items);
  }

  return { indexed: docs.length };
}

/**
 * Upsert a single product search document into OpenSearch.
 */
async function upsertProduct(doc) {
  await ensureIndex();
  const body = {
    ...doc,
    indexedAt: new Date().toISOString()
  };
  await client.index({
    index: INDEX_NAME,
    id: doc.productId,
    body,
    refresh: 'wait_for'
  });
}

/**
 * Search products with multi_match fuzzy search, filters, and highlighting.
 */
async function searchProducts({ q, category, city, minPaise, maxPaise, limit = 50 } = {}) {
  await ensureIndex();

  const must = [];
  if (q && q.trim()) {
    must.push({
      multi_match: {
        query: q.trim(),
        fields: ['name^3', 'brand^2', 'description'],
        fuzziness: 'AUTO'
      }
    });
  } else {
    must.push({ match_all: {} });
  }

  const filter = [];
  if (category && category !== 'All') {
    filter.push({ term: { category } });
  }

  if (city) {
    const trimmedCity = city.trim();
    const capitalizedCity = trimmedCity.charAt(0).toUpperCase() + trimmedCity.slice(1).toLowerCase();
    filter.push({
      terms: {
        cities: [trimmedCity, capitalizedCity]
      }
    });
  }

  if (minPaise !== undefined || maxPaise !== undefined) {
    const range = {};
    if (minPaise !== undefined && minPaise !== '') range.gte = Number(minPaise);
    if (maxPaise !== undefined && maxPaise !== '') range.lte = Number(maxPaise);
    if (Object.keys(range).length > 0) {
      filter.push({ range: { pricePaise: range } });
    }
  }

  const query = {
    bool: {
      must,
      filter
    }
  };

  const response = await client.search({
    index: INDEX_NAME,
    body: {
      size: limit ? parseInt(limit, 10) : 50,
      query,
      highlight: {
        fields: {
          name: {},
          description: {}
        }
      }
    }
  });

  const took = response.body.took;
  const total = typeof response.body.hits.total === 'number'
    ? response.body.hits.total
    : response.body.hits.total.value;

  const hits = response.body.hits.hits.map((hit) => ({
    ...hit._source,
    highlight: hit.highlight || {}
  }));

  return { took, total, hits };
}

/**
 * Compare PostgreSQL truth with OpenSearch derived index for inventory reconciliation.
 */
async function getReconciliation() {
  await ensureIndex();
  const [pgDocs, outboxMetrics] = await Promise.all([
    db.getAllProductSearchDocs(),
    db.getOutboxMetrics()
  ]);

  if (!pgDocs || pgDocs.length === 0) {
    return {
      checkedAt: new Date().toISOString(),
      mismatches: 0,
      rows: []
    };
  }

  const isDraining = (outboxMetrics.pending + outboxMetrics.processing) > 0;

  // Retrieve all products from OpenSearch in bulk
  let osDocs = [];
  try {
    const mgetRes = await client.mget({
      index: INDEX_NAME,
      body: {
        docs: pgDocs.map((d) => ({ _id: d.productId }))
      }
    });
    osDocs = mgetRes.body.docs || [];
  } catch (err) {
    console.error('Error fetching OpenSearch docs for reconciliation:', err.message);
  }

  const osDocMap = new Map();
  for (const doc of osDocs) {
    if (doc.found && doc._source) {
      osDocMap.set(doc._id, doc._source);
    }
  }

  const rows = pgDocs.map((pgDoc) => {
    const osDoc = osDocMap.get(pgDoc.productId);

    if (!osDoc) {
      return {
        productId: pgDoc.productId,
        name: pgDoc.name,
        pgTotalStock: pgDoc.totalStock,
        osTotalStock: 0,
        pgCities: pgDoc.cities || [],
        osCities: [],
        status: 'MISSING'
      };
    }

    const pgTotalStock = pgDoc.totalStock;
    const osTotalStock = osDoc.totalStock ?? 0;
    const pgCities = (pgDoc.cities || []).slice().sort();
    const osCities = (osDoc.cities || []).slice().sort();

    const stockEqual = pgTotalStock === osTotalStock;
    const citiesEqual =
      pgCities.length === osCities.length &&
      pgCities.every((c, i) => c === osCities[i]);

    let status = 'PASS';
    if (!stockEqual || !citiesEqual) {
      status = isDraining ? 'SYNCING' : 'FAIL';
    }

    return {
      productId: pgDoc.productId,
      name: pgDoc.name,
      pgTotalStock,
      osTotalStock,
      pgCities: pgDoc.cities || [],
      osCities: osDoc.cities || [],
      status
    };
  });

  const mismatches = rows.filter((r) => r.status !== 'PASS').length;

  return {
    checkedAt: new Date().toISOString(),
    mismatches,
    rows
  };
}

module.exports = {
  INDEX_NAME,
  ensureIndex,
  bulkIndexAll,
  upsertProduct,
  searchProducts,
  getReconciliation
};
