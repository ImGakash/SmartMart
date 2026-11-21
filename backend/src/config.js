const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });

const REQUIRED_ENV_VARS = [
  'DATABASE_URL',
  'PG_CA_CERT_PATH',
  'KAFKA_BROKERS',
  'KAFKA_USERNAME',
  'KAFKA_PASSWORD',
  'KAFKA_CA_CERT_PATH',
  'OPENSEARCH_URL',
  'OPENSEARCH_USERNAME',
  'OPENSEARCH_PASSWORD',
  'OPENSEARCH_CA_CERT_PATH'
];

// Startup validation: check all required env vars
const missingVars = REQUIRED_ENV_VARS.filter((varName) => !process.env[varName] || !process.env[varName].trim());

if (missingVars.length > 0) {
  console.error('================================================================');
  console.error('FATAL: Missing critical environment variable(s) for backend:');
  missingVars.forEach((v) => console.error(`  - ${v}`));
  console.error('The application cannot start without complete configuration.');
  console.error('================================================================');
  process.exit(1);
}

const config = {
  nodeEnv: process.env.NODE_ENV || 'development',
  port: parseInt(process.env.PORT || '4000', 10),
  databaseUrl: process.env.DATABASE_URL,
  pgPoolMax: parseInt(process.env.PG_POOL_MAX || '8', 10),
  pgCaCertPath: process.env.PG_CA_CERT_PATH,
  kafkaBrokers: process.env.KAFKA_BROKERS,
  kafkaUsername: process.env.KAFKA_USERNAME,
  kafkaPassword: process.env.KAFKA_PASSWORD,
  kafkaCaCertPath: process.env.KAFKA_CA_CERT_PATH,
  kafkaAuthMode: process.env.KAFKA_AUTH_MODE || 'sasl',
  opensearchUrl: process.env.OPENSEARCH_URL,
  opensearchUsername: process.env.OPENSEARCH_USERNAME,
  opensearchPassword: process.env.OPENSEARCH_PASSWORD,
  opensearchCaCertPath: process.env.OPENSEARCH_CA_CERT_PATH,
  allowedOrigins: process.env.ALLOWED_ORIGINS || 'http://localhost:5173,http://localhost:4000',
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

// Redact connection strings / passwords for safe logging
function redactUrl(rawUrl) {
  if (!rawUrl) return '(unset)';
  try {
    const parsed = new URL(rawUrl);
    if (parsed.password) parsed.password = '***';
    return parsed.toString();
  } catch {
    return rawUrl.replace(/:([^@]+)@/, ':***@');
  }
}

// Log resolved config at startup (redacted)
console.log('--- Resolved Startup Configuration ---');
console.log(`  NODE_ENV:                 ${config.nodeEnv}`);
console.log(`  PORT:                     ${config.port}`);
console.log(`  DATABASE_URL:             ${redactUrl(config.databaseUrl)}`);
console.log(`  PG_POOL_MAX:              ${config.pgPoolMax}`);
console.log(`  PG_CA_CERT_PATH:          ${config.pgCaCertPath}`);
console.log(`  KAFKA_BROKERS:            ${config.kafkaBrokers}`);
console.log(`  KAFKA_USERNAME:           ${config.kafkaUsername}`);
console.log(`  KAFKA_PASSWORD:           ***`);
console.log(`  KAFKA_CA_CERT_PATH:       ${config.kafkaCaCertPath}`);
console.log(`  OPENSEARCH_URL:           ${redactUrl(config.opensearchUrl)}`);
console.log(`  OPENSEARCH_USERNAME:      ${config.opensearchUsername}`);
console.log(`  OPENSEARCH_PASSWORD:      ***`);
console.log(`  OPENSEARCH_CA_CERT_PATH:  ${config.opensearchCaCertPath}`);
console.log(`  ALLOWED_ORIGINS:          ${config.allowedOrigins}`);
console.log(`  OUTBOX_LEASE_SECONDS:     ${config.outboxLeaseSeconds}s`);
console.log(`  KAFKA_PUBLISH_TIMEOUT_MS: ${config.kafkaPublishTimeoutMs}ms`);
console.log('---------------------------------------');

module.exports = config;
