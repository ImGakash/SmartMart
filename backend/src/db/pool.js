const fs = require('fs');
const path = require('path');
const pg = require('pg');

// Ensure .env is loaded
require('dotenv').config({ path: path.resolve(__dirname, '../../.env') });

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

if (!process.env.DATABASE_URL) {
  throw new Error('DATABASE_URL environment variable is required');
}

const connectionString = process.env.DATABASE_URL.replace(/[?&]sslmode=[^&]+/, '');

// Resolve CA cert path
let ca;
const caEnvPath = process.env.PG_CA_CERT_PATH;
if (caEnvPath) {
  const possiblePaths = [
    caEnvPath,
    path.resolve(process.cwd(), caEnvPath),
    path.resolve(__dirname, '../../', caEnvPath),
    path.resolve(__dirname, '../', caEnvPath)
  ];
  const foundPath = possiblePaths.find((p) => fs.existsSync(p));
  if (!foundPath) {
    throw new Error(`PG_CA_CERT_PATH specified (${caEnvPath}) but file not found`);
  }
  ca = fs.readFileSync(foundPath);
} else {
  const fallbackCa = [
    path.resolve(__dirname, '../../ca.pem'),
    path.resolve(__dirname, '../ca.pem')
  ].find((p) => fs.existsSync(p));
  if (fallbackCa) {
    ca = fs.readFileSync(fallbackCa);
  }
}

const ssl = {
  ca,
  rejectUnauthorized: true
};

const pool = new pg.Pool({
  connectionString,
  max: parseInt(process.env.PG_POOL_MAX || '8', 10),
  ssl
});

// Handle idle client network drops/resets to prevent unhandled process crash
pool.on('error', (err) => {
  console.warn('Unexpected error on idle PostgreSQL client in pool:', err.message);
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
