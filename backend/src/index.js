const app = require('./api/app');
const config = require('./config');

const server = app.listen(config.port, () => {
  console.log(`SmartMart backend listening on http://localhost:${config.port}`);
  console.log(`- Health check: http://localhost:${config.port}/health`);
  console.log(`- API base URL: http://localhost:${config.port}/api`);
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('SIGTERM received, closing HTTP server...');
  server.close(() => {
    console.log('HTTP server closed.');
    process.exit(0);
  });
});

process.on('SIGINT', () => {
  console.log('SIGINT received, closing HTTP server...');
  server.close(() => {
    console.log('HTTP server closed.');
    process.exit(0);
  });
});

module.exports = server;
