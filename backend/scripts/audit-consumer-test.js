const { producer } = require('../src/events/kafka');
const { startAuditConsumer, stopAuditConsumer } = require('../src/events/auditConsumer');
const { bus } = require('../src/events/bus');
const { randomUUID } = require('crypto');

async function runAuditConsumerTest() {
  console.log('=== STEP 9: AUDIT CONSUMER & SSE WIRING TEST ===\n');

  const testOrderId = randomUUID();
  const orderEventId = randomUUID();
  const inventoryEventId = randomUUID();

  try {
    // 1. Connect Producer and start Audit Consumer
    console.log('[1] Connecting Producer and starting Audit Consumer (audit-timeline)...');
    await producer.connect();
    await startAuditConsumer();

    // 2. Set up Promises to wait for the KAFKA_EVENT_RECEIVED bus events
    const orderEventPromise = new Promise((resolve) => {
      bus.once(`order:${testOrderId}`, (data) => {
        if (data.stage === 'KAFKA_EVENT_RECEIVED' && data.detail.eventType === 'OrderPlaced') {
          resolve(data);
        }
      });
    });

    const inventoryEventPromise = new Promise((resolve) => {
      bus.once(`order:${testOrderId}`, (data) => {
        if (data.stage === 'KAFKA_EVENT_RECEIVED' && data.detail.eventType === 'StoreStockChanged') {
          resolve(data);
        }
      });
    });

    // 3. Publish OrderPlaced event
    console.log('\n[2] Publishing OrderPlaced event to order-events...');
    const orderEnvelope = {
      schemaVersion: 1,
      eventId: orderEventId,
      eventType: 'OrderPlaced',
      occurredAt: new Date().toISOString(),
      orderId: testOrderId,
      orderNumber: 'SM-AUDIT-001',
      totalPaise: 299900
    };

    await producer.send({
      topic: 'order-events',
      messages: [{ key: testOrderId, value: JSON.stringify(orderEnvelope) }]
    });

    // 4. Publish StoreStockChanged event
    console.log('[3] Publishing StoreStockChanged event to inventory-events...');
    const inventoryEnvelope = {
      schemaVersion: 1,
      eventId: inventoryEventId,
      eventType: 'StoreStockChanged',
      occurredAt: new Date().toISOString(),
      productId: '10000000-0000-4000-8000-000000000001',
      storeId: '20000000-0000-4000-8000-000000000001',
      qtySold: 1,
      source: 'ONLINE',
      orderId: testOrderId
    };

    await producer.send({
      topic: 'inventory-events',
      messages: [{ key: '10000000-0000-4000-8000-000000000001', value: JSON.stringify(inventoryEnvelope) }]
    });

    // 5. Wait for both bus events (max 10 seconds each)
    console.log('\n[4] Awaiting consumption of both topics...');
    const [orderBusEvent, inventoryBusEvent] = await Promise.all([
      Promise.race([
        orderEventPromise,
        new Promise((_, reject) => setTimeout(() => reject(new Error('Timeout waiting for OrderPlaced KAFKA_EVENT_RECEIVED')), 10000))
      ]),
      Promise.race([
        inventoryEventPromise,
        new Promise((_, reject) => setTimeout(() => reject(new Error('Timeout waiting for StoreStockChanged KAFKA_EVENT_RECEIVED')), 10000))
      ])
    ]);

    // 6. Verifications
    console.log('\n[5] Verifications:');
    console.log('    OrderPlaced bus event:', JSON.stringify(orderBusEvent, null, 2));
    console.log('    StoreStockChanged bus event:', JSON.stringify(inventoryBusEvent, null, 2));

    const orderReceived = orderBusEvent && orderBusEvent.stage === 'KAFKA_EVENT_RECEIVED';
    const inventoryReceived = inventoryBusEvent && inventoryBusEvent.stage === 'KAFKA_EVENT_RECEIVED';
    const orderMetadataComplete = orderBusEvent && 
      orderBusEvent.detail.eventType === 'OrderPlaced' &&
      orderBusEvent.detail.eventId === orderEventId &&
      orderBusEvent.detail.topic === 'order-events';
    const inventoryMetadataComplete = inventoryBusEvent && 
      inventoryBusEvent.detail.eventType === 'StoreStockChanged' &&
      inventoryBusEvent.detail.eventId === inventoryEventId &&
      inventoryBusEvent.detail.topic === 'inventory-events';

    console.log('\n[6] Summary:');
    console.log(`    - OrderPlaced received on order-events: ${orderReceived ? 'PASS' : 'FAIL'}`);
    console.log(`    - StoreStockChanged received on inventory-events: ${inventoryReceived ? 'PASS' : 'FAIL'}`);
    console.log(`    - OrderPlaced metadata payload complete: ${orderMetadataComplete ? 'PASS' : 'FAIL'}`);
    console.log(`    - StoreStockChanged metadata payload complete: ${inventoryMetadataComplete ? 'PASS' : 'FAIL'}`);

    if (orderReceived && inventoryReceived && orderMetadataComplete && inventoryMetadataComplete) {
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

runAuditConsumerTest();