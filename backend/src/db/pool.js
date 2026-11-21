const pg = require('pg');
require('dotenv').config({ path: __dirname + '/../../.env' });

// BIGINT parsing: pg.types.setTypeParser(20, Number)
pg.types.setTypeParser(20, (val) => (val === null ? null : Number(val)));

class DbError extends Error {
  constructor(code, details = {}) {
    super(code);
    this.name = 'DbError';
    this.code = code;
    this.details = details;
  }
}

const connectionString = (process.env.DATABASE_URL || 'postgres://avnadmin:AVNS_rmybKIjP2M12yuKPjGd@pg-1e06436c-smartmart-2026.h.aivencloud.com:21035/defaultdb').replace(/[?&]sslmode=[^&]+/, '');

const pool = new pg.Pool({
  connectionString,
  max: parseInt(process.env.PG_POOL_MAX || '8', 10),
  ssl: {
    rejectUnauthorized: false
  }
});

async function withTransaction(fn) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await fn(client);
    await client.query('COMMIT');
    return result;
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

module.exports = {
  pool,
  withTransaction,
  DbError
};
