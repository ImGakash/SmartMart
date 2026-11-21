const app = require('./api/server');
const config = require('./config');
const { pool } = require('./db/pool');
const { producer } = require('./events/kafka');
const { startOutboxRelay, stopOutboxRelay } = require('./events/outboxRelay');
const { startNotificationsConsumer, stopNotificationsConsumer } = require('./events/notificationsConsumer');
const { startSearchIndexerConsumer, stopSearchIndexerConsumer } = require('./events/searchIndexerConsumer');
const { startAuditConsumer, stopAuditConsumer } = require('./events/auditConsumer');

let server = null;

async function bootstrap() {
  console.log('=== SMARTMART BACKEND SERVER BOOTSTRAP ===');

  try {
    // 1. Verify Database Connectivity
    console.log('[1/5] Verifying PostgreSQL connection...');
    await pool.query('SELECT 1');
    console.log('      PostgreSQL connected successfully.');

    // 2. Connect Kafka Producer
    console.log('[2/5] Connecting Kafka Producer...');
    await producer.connect();
    console.log('      Kafka Producer connected.');

    // 3. Start Outbox Relay Loop
    console.log('[3/5] Starting Outbox Relay...');
    await startOutboxRelay();

    // 4. Start Event Consumers
    console.log('[4/5] Starting Kafka Consumers: notifications, search-indexer, audit-timeline...');
    await startNotificationsConsumer();
    await startSearchIndexerConsumer();
    await startAuditConsumer();
    console.log('      All Kafka consumers started.');

    // 5. Start Express HTTP Server
    console.log('[5/5] Starting Express Server...');
    const PORT = process.env.PORT || 4000;
    server = app.listen(PORT, () => {
      console.log(`\n============================================================`);
      console.log(`  SmartMart API & Event Engine running at http://localhost:${PORT}`);
      console.log(`  Topics: order-events, inventory-events`);
      console.log(`  Relay: Outbox Poller Active (lease: ${config.outbox.leaseSeconds}s)`);
      console.log(`  Consumers: notifications, search-indexer, audit-timeline`);
      console.log(`============================================================\n`);
    });

  } catch (err) {
    console.error('FATAL: Server bootstrap failed:', err);
    process.exit(1);
  }
}

async function shutdown(signal) {
  console.log(`\n[Shutdown] Received ${signal}. Initiating graceful shutdown...`);

  // Close Express HTTP server
  if (server) {
    server.close(() => {
      console.log('[Shutdown] Express server stopped accepting connections.');
    });
  }

  // Stop background workers
  try {
    await stopOutboxRelay();
  } catch (err) {
    console.error('[Shutdown] Error stopping outbox relay:', err.message);
  }

  // Stop Kafka consumers
  try {
    await Promise.allSettled([
      stopNotificationsConsumer(),
      stopSearchIndexerConsumer(),
      stopAuditConsumer()
    ]);
  } catch (err) {
    console.error('[Shutdown] Error stopping consumers:', err.message);
  }

  // Disconnect Kafka producer
  try {
    await producer.disconnect();
    console.log('[Shutdown] Kafka Producer disconnected.');
  } catch (err) {
    console.error('[Shutdown] Error disconnecting Kafka producer:', err.message);
  }

  // Close Database Pool
  try {
    await pool.end();
    console.log('[Shutdown] PostgreSQL connection pool drained.');
  } catch (err) {
    console.error('[Shutdown] Error draining database pool:', err.message);
  }

  console.log('[Shutdown] Graceful shutdown complete. Exiting.');
  process.exit(0);
}

process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));

if (require.main === module) {
  bootstrap();
}

module.exports = { bootstrap, shutdown };
