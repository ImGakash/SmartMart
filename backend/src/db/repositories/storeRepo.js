const { pool } = require('../pool');

async function getStores() {
  const res = await pool.query('SELECT id, store_code AS "storeCode", store_name AS "storeName", city, state FROM stores ORDER BY store_code');
  return res.rows;
}

module.exports = {
  getStores
};
