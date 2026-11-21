const { pool, resetDemo, markEventProcessed, insertNotification, getNotifications } = require('../../src/db');
const { randomUUID } = require('crypto');

async function runTestF() {
  console.log('=== TEST F: Notification Consumer Dedup ===');

  await resetDemo();

  const orderRes = await pool.query(`
    INSERT INTO orders (customer_id, store_id, source, total_paise, idempotency_key)
    VALUES (
      '30000000-0000-4000-8000-000000000001',
      '20000000-0000-4000-8000-000000000001',
      'ONLINE',
      129900,
      $1
    )
    RETURNING id;
  `, [randomUUID()]);
  const testOrderId = orderRes.rows[0].id;

  const testEventId = randomUUID();
  const consumerGroup = 'notifications';

  console.log(`- Test Event ID: ${testEventId}`);
  console.log(`- Consumer Group: ${consumerGroup}`);
  console.log(`- Test Order ID: ${testOrderId}`);

  // 1st delivery
  const firstProcessed = await markEventProcessed(null, testEventId, consumerGroup);
  const firstNotif = await insertNotification(null, {
    orderId: testOrderId,
    channel: 'SIMULATED_EMAIL',
    message: 'Order confirmed'
  });

  // 2nd delivery (duplicate)
  const secondProcessed = await markEventProcessed(null, testEventId, consumerGroup);
  const secondNotif = await insertNotification(null, {
    orderId: testOrderId,
    channel: 'SIMULATED_EMAIL',
    message: 'Order confirmed duplicate'
  });

  const allNotifs = await getNotifications(testOrderId);

  console.log(`- First markEventProcessed: ${firstProcessed} (expected true)`);
  console.log(`- First notification inserted: ${firstNotif ? 'Created' : 'null'}`);
  console.log(`- Second markEventProcessed: ${secondProcessed} (expected false)`);
  console.log(`- Second notification inserted: ${secondNotif === null ? 'null (prevented)' : 'duplicate created'}`);
  console.log(`- Total notifications in DB: ${allNotifs.length} (expected 1)`);

  const passed = firstProcessed === true && secondProcessed === false && allNotifs.length === 1 && secondNotif === null;

  if (passed) {
    console.log('-> TEST F STATUS: PASS\n');
    return true;
  } else {
    console.error('-> TEST F STATUS: FAIL\n');
    return false;
  }
}

if (require.main === module) {
  runTestF()
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

module.exports = { runTestF };
