const app = require('./api/app');
const config = require('./config');
const db = require('./db');
const { connectProducer, disconnectAll } = require('./events/kafka');
const outboxRelay = require('./events/outboxRelay');

let server = null;

async function bootstrap() {
  console.log('Bootstrapping SmartMart backend...');

  // 1. Verify DB is reachable
  try {
    await db.pool.query('SELECT 1');
    console.log('Database connected successfully');
  } catch (err) {
    console.error('Fatal: Failed to connect to database at startup:', err.message);
    process.exit(1);
  }

  // 2. Connect Kafka producer
  try {
    await connectProducer();
  } catch (err) {
    console.warn('Warning: Kafka producer connection failed at bootstrap:', err.message);
  }

  // 3. Start Outbox Relay worker loop
  outboxRelay.start();

  // 4. Start HTTP server
  server = app.listen(config.port, () => {
    console.log(`SmartMart backend listening on http://localhost:${config.port}`);
    console.log(`- Health check: http://localhost:${config.port}/health`);
    console.log(`- API base URL: http://localhost:${config.port}/api`);
  });
}

async function shutdown(signal) {
  console.log(`${signal} received, shutting down gracefully...`);
  try {
    await outboxRelay.stop();
    console.log('Outbox relay stopped.');
  } catch (e) {
    console.warn('Error stopping outbox relay:', e.message);
  }

  if (server) {
    await new Promise((resolve) => server.close(resolve));
    console.log('HTTP server closed.');
  }

  try {
    await disconnectAll();
    console.log('Kafka connections closed.');
  } catch (e) {
    console.warn('Error disconnecting Kafka:', e.message);
  }

  try {
    await db.pool.end();
    console.log('Database pool closed.');
  } catch (e) {
    console.warn('Error closing database pool:', e.message);
  }

  console.log('Shutdown complete.');
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
