const fs = require('fs');
const path = require('path');
const { pool } = require('./pool');

const STORES = [
  { id: '20000000-0000-4000-8000-000000000001', storeCode: 'BLR-01', storeName: 'SmartMart Indiranagar', city: 'Bengaluru', state: 'Karnataka', address: '100ft Road, Indiranagar' },
  { id: '20000000-0000-4000-8000-000000000002', storeCode: 'BLR-02', storeName: 'SmartMart Koramangala', city: 'Bengaluru', state: 'Karnataka', address: '80ft Road, Koramangala' },
  { id: '20000000-0000-4000-8000-000000000003', storeCode: 'MUM-01', storeName: 'SmartMart Bandra', city: 'Mumbai', state: 'Maharashtra', address: 'Linking Road, Bandra' },
  { id: '20000000-0000-4000-8000-000000000004', storeCode: 'DEL-01', storeName: 'SmartMart Connaught', city: 'Delhi', state: 'Delhi', address: 'Connaught Place' },
  { id: '20000000-0000-4000-8000-000000000005', storeCode: 'HYD-01', storeName: 'SmartMart Hitec', city: 'Hyderabad', state: 'Telangana', address: 'Hitec City' },
  { id: '20000000-0000-4000-8000-000000000006', storeCode: 'CHE-01', storeName: 'SmartMart T Nagar', city: 'Chennai', state: 'Tamil Nadu', address: 'T Nagar' }
];

async function seed() {
  console.log('Seeding stores...');
  for (const s of STORES) {
    await pool.query(
      `INSERT INTO stores (id, store_code, store_name, city, state, address)
       VALUES ($1, $2, $3, $4, $5, $6)
       ON CONFLICT (id) DO UPDATE SET store_name = EXCLUDED.store_name`,
      [s.id, s.storeCode, s.storeName, s.city, s.state, s.address]
    );
  }

  console.log('Reading products from shared/products.json...');
  const jsonPath = path.resolve(__dirname, '../../../shared/products.json');
  const products = JSON.parse(fs.readFileSync(jsonPath, 'utf8'));

  console.log(`Seeding ${products.length} products...`);
  for (const p of products) {
    await pool.query(
      `INSERT INTO products (id, sku, name, description, category, brand, price_paise, image_url, attributes)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
       ON CONFLICT (id) DO UPDATE SET
         sku = EXCLUDED.sku,
         name = EXCLUDED.name,
         description = EXCLUDED.description,
         category = EXCLUDED.category,
         brand = EXCLUDED.brand,
         price_paise = EXCLUDED.price_paise,
         image_url = EXCLUDED.image_url`,
      [p.id, p.sku, p.name, p.description, p.category, p.brand, p.pricePaise, p.imageUrl, JSON.stringify(p.attributes || {})]
    );
  }

  console.log('Seeding 60 customers...');
  for (let i = 1; i <= 60; i++) {
    const pad = String(i).padStart(2, '0');
    const id = `30000000-0000-4000-8000-0000000000${pad}`;
    const name = `Customer ${i}`;
    const email = `c${pad}@demo.smartmart.in`;
    await pool.query(
      `INSERT INTO customers (id, name, email, city)
       VALUES ($1, $2, $3, 'Bengaluru')
       ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name`,
      [id, name, email]
    );
  }

  console.log('Seeding inventory across all stores...');
  // P01: BLR-01 = 1, all other stores = 0 (per CONTRACT.md §4)
  const P01_ID = '10000000-0000-4000-8000-000000000001';
  const P02_ID = '10000000-0000-4000-8000-000000000002';
  const P03_ID = '10000000-0000-4000-8000-000000000003';

  for (const p of products) {
    for (const s of STORES) {
      let stockQty = 0;
      if (p.id === P01_ID) {
        stockQty = (s.storeCode === 'BLR-01') ? 1 : 0;
      } else if (p.id === P02_ID) {
        stockQty = (s.storeCode === 'BLR-01') ? 10 : 3;
      } else if (p.id === P03_ID) {
        stockQty = (s.storeCode === 'BLR-01') ? 8 : 4;
      } else {
        const seedNum = (parseInt(p.id.slice(-2), 10) + parseInt(s.storeCode.slice(-1), 10)) % 7;
        stockQty = (s.storeCode === 'BLR-01') ? (seedNum === 0 ? 6 : Math.max(6, seedNum * 3)) : (seedNum === 0 ? 0 : seedNum * 3);
      }

      await pool.query(
        `INSERT INTO inventory (store_id, product_id, stock_qty)
         VALUES ($1, $2, $3)
         ON CONFLICT (store_id, product_id) DO UPDATE SET stock_qty = EXCLUDED.stock_qty`,
        [s.id, p.id, stockQty]
      );

      await pool.query(
        `INSERT INTO inventory_baseline (store_id, product_id, baseline_qty)
         VALUES ($1, $2, $3)
         ON CONFLICT (store_id, product_id) DO UPDATE SET baseline_qty = EXCLUDED.baseline_qty`,
        [s.id, p.id, stockQty]
      );
    }
  }

  console.log('Seed completed successfully for 36 products and 6 stores.');
}

if (require.main === module) {
  seed().then(() => pool.end()).catch((e) => { console.error(e); pool.end(); });
}

module.exports = { seed, STORES };
