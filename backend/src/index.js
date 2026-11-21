const app = require('./api/app');
const config = require('./config');
const db = require('./db');
const { connectProducer, disconnectAll, kafkaHealthy } = require('./events/kafka');
const outboxRelay = require('./events/outboxRelay');
const notificationsConsumer = require('./events/notificationsConsumer');
const searchIndexerConsumer = require('./events/searchIndexerConsumer');
const { ensureIndex, bulkIndexAll } = require('./search/productIndex');

let server = null;

async function bootstrap() {
  console.log('Bootstrapping SmartMart backend...');

  // 1. Verify DB is reachable
  try {
    await db.pool.query('SELECT 1');
    console.log('[Bootstrap] Database connected successfully');
  } catch (err) {
    console.error('Fatal: Failed to connect to database at startup:', err.message);
    process.exit(1);
  }

  // 2. Initialize OpenSearch index & perform initial bulk sync (36 docs) per CONTRACT.md §9
  try {
    await ensureIndex();
    const indexResult = await bulkIndexAll();
    console.log(`[Bootstrap] OpenSearch initial bulk index complete: ${indexResult.indexed} products indexed`);
  } catch (err) {
    console.warn('[Bootstrap] Warning: OpenSearch index bootstrap deferred or degraded:', err.message);
  }

  // 3. Connect Kafka producer & warm health probe
  try {
    await connectProducer();
    await kafkaHealthy();
    console.log('[Bootstrap] Kafka producer and admin probe ready');
  } catch (err) {
    console.warn('[Bootstrap] Warning: Kafka connection failed at bootstrap:', err.message);
  }

  // 4. Start Outbox Relay worker loop
  outboxRelay.start();
  console.log('[Bootstrap] Outbox relay loop started');

  // 5. Start Kafka Consumers (§8)
  try {
    await notificationsConsumer.start();
    console.log('[Bootstrap] Notifications consumer started');
  } catch (err) {
    console.warn('[Bootstrap] Warning: Notifications consumer failed to start:', err.message);
  }

  try {
    await searchIndexerConsumer.start();
    console.log('[Bootstrap] Search indexer consumer started');
  } catch (err) {
    console.warn('[Bootstrap] Warning: Search indexer consumer failed to start:', err.message);
  }

  // 6. Start HTTP server
  server = app.listen(config.port, () => {
    console.log(`[Bootstrap] SmartMart backend listening on http://localhost:${config.port}`);
    console.log(`  - Health check: http://localhost:${config.port}/health`);
    console.log(`  - API base URL: http://localhost:${config.port}/api`);
  });
}

let isShuttingDown = false;

async function shutdown(signal) {
  if (isShuttingDown) return;
  isShuttingDown = true;
  console.log(`\n[Shutdown] ${signal} received, beginning graceful shutdown...`);

  // Force-kill watchdog: 10 seconds maximum
  const forceKillTimer = setTimeout(() => {
    console.error('[Shutdown] Force-kill timeout (10s) reached. Exiting with code 1.');
    process.exit(1);
  }, 10000);
  forceKillTimer.unref();

  // 1. Stop accepting new HTTP connections
  if (server) {
    try {
      await new Promise((resolve) => server.close(resolve));
      console.log('[Shutdown] 1/5: HTTP server stopped accepting connections.');
    } catch (e) {
      console.warn('[Shutdown] Error closing HTTP server:', e.message);
    }
  }

  // 2. Stop Outbox Relay loop
  try {
    await outboxRelay.stop();
    console.log('[Shutdown] 2/5: Outbox relay worker stopped.');
  } catch (e) {
    console.warn('[Shutdown] Error stopping outbox relay:', e.message);
  }

  // 3. Stop Consumers
  try {
    await notificationsConsumer.stop();
    await searchIndexerConsumer.stop();
    console.log('[Shutdown] 3/5: Kafka consumers stopped.');
  } catch (e) {
    console.warn('[Shutdown] Error stopping consumers:', e.message);
  }

  // 4. Disconnect Kafka clients (producer, admin, consumers)
  try {
    await disconnectAll();
    console.log('[Shutdown] 4/5: Kafka connections cleanly disconnected.');
  } catch (e) {
    console.warn('[Shutdown] Error disconnecting Kafka:', e.message);
  }

  // 5. Close Database pool
  try {
    await db.pool.end();
    console.log('[Shutdown] 5/5: Database pool drained and closed.');
  } catch (e) {
    console.warn('[Shutdown] Error closing database pool:', e.message);
  }

  clearTimeout(forceKillTimer);
  console.log('[Shutdown] Graceful shutdown completed cleanly. Exiting.');
  process.exit(0);
}

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));

bootstrap().catch((err) => {
  console.error('Fatal bootstrap error:', err);
  process.exit(1);
});

module.exports = {
  get server() {
    return server;
  }
};
