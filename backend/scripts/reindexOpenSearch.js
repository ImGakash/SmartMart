require('dotenv').config({ path: require('path').resolve(__dirname, '../.env') });
require('dotenv/config');
const { client } = require('../src/search/client');
const { ensureIndex } = require('../src/search/indexService');

const sampleProducts = [
  {
    productId: 'P01',
    name: 'boAt Airdopes 141 Bluetooth Earphones',
    brand: 'boAt',
    category: 'Audio',
    description: 'boAt Airdopes 141 True Wireless Earbuds with 42H Playtime, Beast Mode, and ENx Technology.',
    pricePaise: 129900,
    totalStock: 1,
    cities: ['Bengaluru'],
    stores: [
      {
        storeId: 'S01',
        storeCode: 'BLR-01',
        city: 'Bengaluru',
        stockQty: 1
      }
    ]
  },
  {
    productId: 'P03',
    name: 'Eureka Forbes Vacuum Cleaner',
    brand: 'Eureka Forbes',
    category: 'Appliances',
    description: 'Eureka Forbes Quick Clean DX Vacuum Cleaner with 1200 Watts powerful suction and multiple accessories.',
    pricePaise: 899900,
    totalStock: 5,
    cities: ['Bengaluru', 'Mumbai'],
    stores: [
      {
        storeId: 'S01',
        storeCode: 'BLR-01',
        city: 'Bengaluru',
        stockQty: 2
      },
      {
        storeId: 'S02',
        storeCode: 'MUM-01',
        city: 'Mumbai',
        stockQty: 3
      }
    ]
  }
];

async function main() {
  await ensureIndex();

  const indexName = process.env.OPENSEARCH_INDEX || 'smartmart-products';
  const operations = sampleProducts.flatMap((doc) => [
    { index: { _index: indexName, _id: doc.productId } },
    doc
  ]);

  const bulkResponse = await client.bulk({
    refresh: true,
    body: operations
  });

  const errors = bulkResponse.body?.errors ?? bulkResponse.errors;
  if (errors) {
    console.error('❌ Errors occurred during bulk indexing:', JSON.stringify(bulkResponse.body?.items || bulkResponse.items));
  } else {
    console.log(`✅ Successfully indexed ${sampleProducts.length} products to OpenSearch`);
  }
}

if (require.main === module) {
  main()
    .then(() => process.exit(0))
    .catch((err) => {
      console.error('❌ Reindexing failed:', err.message || err);
      process.exit(1);
    });
}

module.exports = { main, sampleProducts };
