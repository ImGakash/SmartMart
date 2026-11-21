const { getAllProductSearchDocs, getProductSearchDoc, pool } = require('../../src/db');

async function runVerifySearchDocs() {
  console.log('=== VERIFYING PRODUCT SEARCH DOCS ===\n');

  // 1. Call getAllProductSearchDocs and verify 36 documents
  const allDocs = await getAllProductSearchDocs();
  console.log(`[1] Total document count: ${allDocs.length} (expect 36)`);
  const countMatch = allDocs.length === 36;

  // 2. Find product P01
  const P01_ID = '10000000-0000-4000-8000-000000000001';
  const p01 = allDocs.find((d) => d.productId === P01_ID);

  console.log('\n[2] Verifying Product P01:');
  console.log(`- Product Name: ${p01.name}`);
  console.log(`- P01 cities array: ${JSON.stringify(p01.cities)} (expect ["Bengaluru"])`);
  const citiesMatch = p01.cities.length === 1 && p01.cities[0] === 'Bengaluru';

  console.log(`- P01 availability array length: ${p01.availability.length}`);
  const zeroStockStores = p01.availability.filter((a) => a.stockQty === 0);
  const availMatch = p01.availability.length === 6 && zeroStockStores.length === 5;

  console.log(`- P01 totalStock value: ${p01.totalStock} (expect 1)`);
  const stockMatch = p01.totalStock === 1;

  const passed = countMatch && citiesMatch && availMatch && stockMatch;
  if (passed) {
    console.log('\n-> SEARCH DOCS STATUS: PASS\n');
    return true;
  } else {
    console.error('\n-> SEARCH DOCS STATUS: FAIL\n');
    return false;
  }
}

if (require.main === module) {
  runVerifySearchDocs()
    .then((pass) => {
      pool.end();
      process.exit(pass ? 0 : 1);
    })
    .catch((err) => {
      console.error(err);
      pool.end();
      process.exit(1);
    });
}

module.exports = { runVerifySearchDocs };
