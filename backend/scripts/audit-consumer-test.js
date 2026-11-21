const { producer } = require('../src/events/kafka');
const { startAuditConsumer, stopAuditConsumer } = require('../src/events/auditConsumer');
const { bus } = require('../src/events/bus');
const { randomUUID } = require('crypto');

async function testAuditConsumer() {
  console.log('=== STEP 9: AUDIT CONSUMER & SSE WIRING TEST ===\n');

  const testOrderId = randomUUID();
  const testProductId = '10000000-0000-4000-8000-000000000001';
  const orderEventId = randomUUID();
  const inventoryEventId = randomUUID();
  const testGroupId = `audit-timeline-test-${Date.now()}`;

  try {
    // 1. Connect Producer and start Consumer
    console.log('[1] Connecting Producer and starting Audit Consumer...');
    await producer.connect();
    await startAuditConsumer({ groupId: testGroupId, fromBeginning: false });

    // 2. Set up Promise-based listener on bus.js
    console.log('[2] Setting up bus.js listeners for OrderPlaced and StoreStockChanged...');
    let resolveOrderEvent;
    let resolveInventoryEvent;

    const orderPromise = new Promise((resolve, reject) => {
      resolveOrderEvent = resolve;
      setTimeout(() => reject(new Error('Timed out waiting for OrderPlaced stage on bus.js (15s)')), 15000);
    });

    const inventoryPromise = new Promise((resolve, reject) => {
      resolveInventoryEvent = resolve;
      setTimeout(() => reject(new Error('Timed out waiting for StoreStockChanged stage on bus.js (15s)')), 15000);
    });

    const capturedEvents = [];
    bus.on(`order:${testOrderId}`, (data) => {
      console.log(`    [bus.js SSE Event Received]: Stage=${data.stage} | Topic=${data.detail && data.detail.topic} | Type=${data.detail && data.detail.eventType}`);
      capturedEvents.push(data);

      if (data.stage === 'KAFKA_EVENT_RECEIVED') {
        if (data.detail.eventType === 'OrderPlaced') {
          resolveOrderEvent(data);
        } else if (data.detail.eventType === 'StoreStockChanged') {
          resolveInventoryEvent(data);
        }
      }
    });

    // 3. Publish OrderPlaced event to order-events
    console.log('\n[3] Publishing OrderPlaced to "order-events"...');
    const orderPayload = {
      schemaVersion: 1,
      eventId: orderEventId,
      eventType: 'OrderPlaced',
      occurredAt: new Date().toISOString(),
      orderId: testOrderId,
      orderNumber: 'SM-AUDIT-999',
      totalPaise: 129900
    };
    await producer.send({
      topic: 'order-events',
      messages: [{ key: testOrderId, value: JSON.stringify(orderPayload) }]
    });

    // 4. Publish StoreStockChanged event to inventory-events
    console.log('\n[4] Publishing StoreStockChanged to "inventory-events"...');
    const inventoryPayload = {
      schemaVersion: 1,
      eventId: inventoryEventId,
      eventType: 'StoreStockChanged',
      occurredAt: new Date().toISOString(),
      productId: testProductId,
      storeId: '20000000-0000-4000-8000-000000000001',
      qtySold: 1,
      source: 'ONLINE',
      orderId: testOrderId
    };
    await producer.send({
      topic: 'inventory-events',
      messages: [{ key: testProductId, value: JSON.stringify(inventoryPayload) }]
    });

    // 5. Await both events via Promise.all
    console.log('\n[5] Awaiting both events via Promise.all...');
    const [orderStage, inventoryStage] = await Promise.all([orderPromise, inventoryPromise]);

    // 6. Assertions
    console.log('\n[6] Contract Verifications:');
    console.log('    OrderPlaced Event Received:');
    console.log('   ', orderStage.detail);
    console.log('    StoreStockChanged Event Received:');
    console.log('   ', inventoryStage.detail);

    const hasOrderFields =
      orderStage.stage === 'KAFKA_EVENT_RECEIVED' &&
      orderStage.detail.eventType === 'OrderPlaced' &&
      orderStage.detail.eventId === orderEventId &&
      orderStage.detail.topic === 'order-events' &&
      typeof orderStage.detail.offset === 'string';

    const hasInventoryFields =
      inventoryStage.stage === 'KAFKA_EVENT_RECEIVED' &&
      inventoryStage.detail.eventType === 'StoreStockChanged' &&
      inventoryStage.detail.eventId === inventoryEventId &&
      inventoryStage.detail.topic === 'inventory-events' &&
      typeof inventoryStage.detail.offset === 'string';

    console.log(`\n    - OrderPlaced stage and metadata complete: ${hasOrderFields ? 'PASS' : 'FAIL'}`);
    console.log(`    - StoreStockChanged stage and metadata complete: ${hasInventoryFields ? 'PASS' : 'FAIL'}`);

    if (hasOrderFields && hasInventoryFields) {
      console.log('\n=== STEP 9 RESULT: PASS ===');
    } else {
      console.log('\n=== STEP 9 RESULT: FAIL ===');
    }

  } catch (err) {
    console.error('\n=== STEP 9 ERROR ===');
    console.error(err.message);
  } finally {
    await stopAuditConsumer();
    try {
      await producer.disconnect();
    } catch (_) {}
  }
}

testAuditConsumer();
