const { client } = require('./client');

async function ensureIndex() {
  const index = process.env.OPENSEARCH_INDEX || 'smartmart-products';
  const existsResponse = await client.indices.exists({ index });
  const exists = existsResponse.body === true || existsResponse === true;

  if (!exists) {
    await client.indices.create({
      index,
      body: {
        settings: {
          number_of_shards: 1,
          number_of_replicas: 0,
          refresh_interval: '1s'
        },
        mappings: {
          properties: {
            productId: { type: 'keyword' },
            name: {
              type: 'text',
              fields: {
                keyword: {
                  type: 'keyword',
                  ignore_above: 256
                }
              }
            },
            brand: {
              type: 'text',
              fields: {
                keyword: {
                  type: 'keyword',
                  ignore_above: 256
                }
              }
            },
            category: { type: 'keyword' },
            description: { type: 'text' },
            pricePaise: { type: 'integer' },
            totalStock: { type: 'integer' },
            cities: { type: 'keyword' },
            stores: {
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
      }
    });
  }

  console.log('✅ OpenSearch index ensured');
}

async function reindexProductById(productDoc) {
  const index = process.env.OPENSEARCH_INDEX || 'smartmart-products';
  if (!productDoc) {
    console.warn('⚠️ Product document not found for reindexing');
    return null;
  }

  if (!productDoc.productId) {
    console.warn('⚠️ Product document missing productId for reindexing');
    return null;
  }

  try {
    const response = await client.index({
      index,
      id: productDoc.productId,
      body: productDoc,
      refresh: true
    });
    console.log(`✅ Product ${productDoc.productId} indexed successfully`);
    return response;
  } catch (err) {
    console.error(`❌ Failed to index product ${productDoc.productId}:`, err.message || err);
    throw err;
  }
}

module.exports = {
  ensureIndex,
  reindexProductById
};
