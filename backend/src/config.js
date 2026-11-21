const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });

function requireEnv(name) {
  const value = process.env[name];
  if (!value) {
    console.error(`FATAL: Missing required environment variable: ${name}`);
    process.exit(1);
  }
  return value;
}

const kafkaBrokers = requireEnv('KAFKA_BROKERS');
const kafkaAuthMode = (process.env.KAFKA_AUTH_MODE || 'sasl').toLowerCase();
const kafkaUsername = process.env.KAFKA_USERNAME || 'avnadmin';
const kafkaPassword = process.env.KAFKA_PASSWORD || '';
const kafkaClientId = process.env.KAFKA_CLIENT_ID || 'smartmart-backend';
const kafkaCaCertPath = process.env.KAFKA_CA_CERT_PATH || '';
const kafkaCertPath = process.env.KAFKA_CERT_PATH || '';
const kafkaKeyPath = process.env.KAFKA_KEY_PATH || '';

const outboxBatchSize = parseInt(process.env.OUTBOX_BATCH_SIZE || '20', 10);
const outboxLeaseSeconds = parseInt(process.env.OUTBOX_LEASE_SECONDS || '10', 10);
const outboxPollMs = parseInt(process.env.OUTBOX_POLL_INTERVAL_MS || '1000', 10);
const kafkaPublishTimeoutMs = parseInt(process.env.KAFKA_PUBLISH_TIMEOUT_MS || '8000', 10);

// MANDATORY STARTUP ASSERTION (Invariant #9)
const leaseMs = outboxLeaseSeconds * 1000;
const requiredMinLeaseMs = kafkaPublishTimeoutMs + 1000;
if (!(leaseMs > requiredMinLeaseMs)) {
  console.error(
    `FATAL: Invariant violation. OUTBOX_LEASE_SECONDS*1000 (${leaseMs}) must be > KAFKA_PUBLISH_TIMEOUT_MS + 1000 (${requiredMinLeaseMs}).`
  );
  process.exit(1);
}

const config = {
  kafka: {
    brokers: kafkaBrokers.split(',').filter(Boolean),
    authMode: kafkaAuthMode,
    clientId: kafkaClientId,
    username: kafkaUsername,
    password: kafkaPassword,
    caCertPath: kafkaCaCertPath,
    certPath: kafkaCertPath,
    keyPath: kafkaKeyPath,
    publishTimeoutMs: kafkaPublishTimeoutMs
  },
  outbox: {
    batchSize: outboxBatchSize,
    leaseSeconds: outboxLeaseSeconds,
    pollMs: outboxPollMs
  }
};

module.exports = config;