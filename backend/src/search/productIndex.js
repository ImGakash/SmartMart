const { request } = require('./client');

const INDEX_NAME = 'smartmart-products';

// OpenSearch Mapping per CONTRACT.md §9:
// name text (^3), brand text (^2), description text
// category, cities, sku, productId keyword
// pricePaise long, availability nested, totalStock integer
const mapping = {
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
 * Ensures the index exists with proper schema mapping.
 */
async function ensureProductIndex() {
  try {
    await request('GET', `/${INDEX_NAME}`);
  } catch (err) {
    if (err.statusCode === 404) {
      console.log(`[OpenSearch] Index "${INDEX_NAME}" not found. Creating...`);
      await request('PUT', `/${INDEX_NAME}`, mapping);
      console.log(`[OpenSearch] Index "${INDEX_NAME}" created with mappings.`);
    } else {
      throw err;
    }
  }
}

/**
 * Deterministic upsert into OpenSearch (_id = productId, refresh: 'wait_for')
 * @param {object} doc - Search document (§9)
 */
async function upsertProductSearchDoc(doc) {
  if (!doc || !doc.productId) {
    throw new Error('upsertProductSearchDoc: doc.productId is required');
  }

  const endpoint = `/${INDEX_NAME}/_doc/${encodeURIComponent(doc.productId)}?refresh=wait_for`;
  return await request('PUT', endpoint, doc);
}

/**
 * Fetch a single document by productId.
 * @param {string} productId 
 */
async function getIndexedProduct(productId) {
  try {
    const res = await request('GET', `/${INDEX_NAME}/_doc/${encodeURIComponent(productId)}`);
    return res._source;
  } catch (err) {
    if (err.statusCode === 404) return null;
    throw err;
  }
}

/**
 * Bulk index helper for seeding OpenSearch.
 * @param {Array<object>} docs 
 */
async function bulkIndexProducts(docs) {
  await ensureProductIndex();

  let body = '';
  for (const doc of docs) {
    body += JSON.stringify({ index: { _index: INDEX_NAME, _id: doc.productId } }) + '\n';
    body += JSON.stringify(doc) + '\n';
  }

  const res = await request('POST', '/_bulk?refresh=true', body);
  return res;
}

module.exports = {
  INDEX_NAME,
  ensureProductIndex,
  upsertProductSearchDoc,
  getIndexedProduct,
  bulkIndexProducts
};
