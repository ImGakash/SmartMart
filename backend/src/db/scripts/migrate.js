const fs = require('fs');
const path = require('path');
const { pool, withTransaction } = require('../pool');

async function migrate() {
  console.log('Running database migrations...');

  await pool.query(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      version TEXT PRIMARY KEY,
      applied_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );
  `);

  const migrationsDir = path.resolve(__dirname, '../migrations');
  const files = fs
    .readdirSync(migrationsDir)
    .filter((f) => f.endsWith('.sql'))
    .sort();

  let appliedCount = 0;
  for (const file of files) {
    const existing = await pool.query('SELECT version FROM schema_migrations WHERE version = $1', [file]);
    if (existing.rows.length > 0) {
      console.log(`- Migration ${file}: already applied (skipping).`);
      continue;
    }

    console.log(`- Applying migration: ${file}...`);
    const sqlPath = path.join(migrationsDir, file);
    const sql = fs.readFileSync(sqlPath, 'utf8');

    await withTransaction(async (tx) => {
      await tx.query(sql);
      await tx.query('INSERT INTO schema_migrations (version) VALUES ($1)', [file]);
    });

    console.log(`  -> ${file} applied successfully.`);
    appliedCount++;
  }

  console.log(`Migrations complete. ${appliedCount} new migration(s) applied.`);
  return appliedCount;
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
