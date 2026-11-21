const { pool, withTransaction, resetDemo } = require('../../src/db');

async function runTestI() {
  console.log('=== TEST I: 50-way Concurrency Race Through Pool of 8 ===');

  await resetDemo();

  const start = Date.now();
  const tasks = [];

  for (let i = 0; i < 50; i++) {
    tasks.push(
      withTransaction(async (tx) => {
        const res = await tx.query('SELECT $1::integer AS num, COUNT(*)::integer AS total FROM products', [i]);
        return res.rows[0];
      })
    );
  }

  const results = await Promise.all(tasks);
  const durationMs = Date.now() - start;

  console.log(`- 50 concurrent transactions completed in: ${durationMs}ms (timeout: 30,000ms)`);
  console.log(`- Results count: ${results.length}`);
  console.log(`- Pool state after race: totalCount=${pool.totalCount}, idleCount=${pool.idleCount}, waitingCount=${pool.waitingCount}`);

  const durationValid = durationMs < 30000;
  const noWaiting = pool.waitingCount === 0;
  const maxRespected = pool.totalCount <= 8;
  const allIdle = pool.idleCount === pool.totalCount; // no leaked checked-out clients

  console.log(`- Completed under 30s: ${durationValid}`);
  console.log(`- Pool max 8 respected: ${maxRespected}`);
  console.log(`- Zero waiting clients: ${noWaiting}`);
  console.log(`- No leaked clients (all idle): ${allIdle}`);

  const passed = durationValid && noWaiting && maxRespected && allIdle && results.length === 50;

  if (passed) {
    console.log('-> TEST I STATUS: PASS\n');
    return true;
  } else {
    console.error('-> TEST I STATUS: FAIL\n');
    return false;
  }
}

if (require.main === module) {
  runTestI()
    .then((pass) => {
      pool.end();
      process.exit(pass ? 0 : 1);
    })
    .catch((err) => {
      console.error(err);
      pool.end();
      process.exit(1);
    });
}

module.exports = { runTestI };
