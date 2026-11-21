const { pool } = require('../pool');

async function getCustomers() {
  const res = await pool.query('SELECT id, name, email, city FROM customers ORDER BY email');
  return res.rows;
}

module.exports = {
  getCustomers
};
