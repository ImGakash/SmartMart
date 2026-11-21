const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });

const config = {
  port: parseInt(process.env.PORT || '4000', 10),
  databaseUrl: process.env.DATABASE_URL,
  pgPoolMax: parseInt(process.env.PG_POOL_MAX || '8', 10),
  pgCaCertPath: process.env.PG_CA_CERT_PATH,
  outboxBatchSize: parseInt(process.env.OUTBOX_BATCH_SIZE || '20', 10),
  outboxPollMs: parseInt(process.env.OUTBOX_POLL_MS || '1000', 10),
  outboxLeaseSeconds: parseInt(process.env.OUTBOX_LEASE_SECONDS || '10', 10),
  outboxMaxAttempts: parseInt(process.env.OUTBOX_MAX_ATTEMPTS || '5', 10),
  kafkaPublishTimeoutMs: parseInt(process.env.KAFKA_PUBLISH_TIMEOUT_MS || '8000', 10)
};

// Startup assertion per CONTRACT.md §14 / §17
if (config.outboxLeaseSeconds * 1000 <= config.kafkaPublishTimeoutMs + 1000) {
  console.error(
    `CONFIG ASSERTION FAILED: OUTBOX_LEASE_SECONDS*1000 (${config.outboxLeaseSeconds * 1000}ms) ` +
    `must be > KAFKA_PUBLISH_TIMEOUT_MS + 1000ms (${config.kafkaPublishTimeoutMs + 1000}ms)`
  );
  process.exit(1);
}

module.exports = config;
