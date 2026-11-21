const fs = require('fs');
const path = require('path');
const { pool } = require('../pool');

async function migrate() {
  const sqlPath = path.resolve(__dirname, '../migrations/001_init.sql');
  const sql = fs.readFileSync(sqlPath, 'utf8');
  console.log('Running migration: 001_init.sql...');
  await pool.query(sql);
  console.log('Migration completed successfully.');
}

if (require.main === module) {
  migrate()
    .then(() => pool.end())
    .catch((err) => {
      console.error('Migration failed:', err);
      pool.end();
      process.exit(1);
    });
}

module.exports = { migrate };
