const { resetDemo, pool } = require('../index');

async function main() {
  console.log('Resetting SmartMart demo state per §13...');
  const res = await resetDemo();
  console.log(`Demo reset completed successfully in ${res.durationMs}ms.`);
}

if (require.main === module) {
  main()
    .then(() => pool.end())
    .catch((err) => {
      console.error('Demo reset failed:', err);
      pool.end();
      process.exit(1);
    });
}

module.exports = { main };
