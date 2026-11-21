const { getAllProductSearchDocs, getProductSearchDoc } = require('../repositories/productRepo');
const { pool } = require('../pool');

async function verify() {
  console.log('=== VERIFYING PRODUCT SEARCH DOCS ===\n');

  try {
    // 1. Call getAllProductSearchDocs and verify 36 documents
    const allDocs = await getAllProductSearchDocs();
    console.log(`[1] Total document count: ${allDocs.length} (expect 36)`);
    if (allDocs.length === 36) {
      console.log('    -> PASS: exactly 36 search documents returned.');
    } else {
      console.log(`    -> FAIL: expected 36, got ${allDocs.length}`);
    }

    // 2. Find product P01
    const P01_ID = '10000000-0000-4000-8000-000000000001';
    const p01 = allDocs.find((d) => d.productId === P01_ID);

    console.log('\n[2] Verifying Product P01:');
    console.log(`- Product Name: ${p01.name}`);
    console.log(`- P01 cities array: ${JSON.stringify(p01.cities)} (expect ["Bengaluru"])`);
    const citiesMatch = p01.cities.length === 1 && p01.cities[0] === 'Bengaluru';
    console.log(`  -> Cities check: ${citiesMatch ? 'PASS' : 'FAIL'}`);

    console.log(`- P01 availability array length: ${p01.availability.length}`);
    const zeroStockStores = p01.availability.filter((a) => a.stockQty === 0);
    console.log(`- Zero-stock stores included: ${zeroStockStores.length} stores (BLR-02, MUM-01, DEL-01, HYD-01, CHE-01)`);
    const availMatch = p01.availability.length === 6 && zeroStockStores.length === 5;
    console.log(`  -> Availability check: ${availMatch ? 'PASS (all 6 stores included with zero-stock stores)' : 'FAIL'}`);

    console.log(`- P01 totalStock value: ${p01.totalStock} (expect 1)`);
    const stockMatch = p01.totalStock === 1;
    console.log(`  -> Total stock check: ${stockMatch ? 'PASS' : 'FAIL'}`);

    // 3. Print full document structure for P01
    console.log('\n[3] Full JSON structure of P01 document:');
    console.log(JSON.stringify(p01, null, 2));

    // 4. Verify a few other products
    console.log('\n[4] Consistency check on other products:');
    const p02 = allDocs.find((d) => d.productId === '10000000-0000-4000-8000-000000000002');
    const p03 = allDocs.find((d) => d.productId === '10000000-0000-4000-8000-000000000003');
    console.log(`- P02: name="${p02.name}", totalStock=${p02.totalStock}, cities=${JSON.stringify(p02.cities)}, storesCount=${p02.availability.length}`);
    console.log(`- P03: name="${p03.name}", totalStock=${p03.totalStock}, cities=${JSON.stringify(p03.cities)}, storesCount=${p03.availability.length}`);

    if (allDocs.length === 36 && citiesMatch && availMatch && stockMatch) {
      console.log('\n=== ALL SEARCH DOC CONTRACT CHECKS PASSED ===');
    }

  } catch (err) {
    console.error('Error during verification:', err);
  } finally {
    await pool.end();
  }
}

verify();
