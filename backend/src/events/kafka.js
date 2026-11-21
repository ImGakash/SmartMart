process.env.KAFKAJS_NO_PARTITIONER_WARNING = '1';

const fs = require('fs');
const path = require('path');
const { Kafka } = require('kafkajs');
const config = require('../config');

// Resolve CA certificate path with fallback resolution
function getKafkaCaCert() {
  const caEnvPath = process.env.KAFKA_CA_CERT_PATH || 'ca.pem';
  const possiblePaths = [
    caEnvPath,
    path.resolve(process.cwd(), caEnvPath),
    path.resolve(__dirname, '../../../', caEnvPath),
    path.resolve(__dirname, '../../', caEnvPath),
    path.resolve(__dirname, '../', caEnvPath),
    path.resolve(__dirname, caEnvPath)
  ];
  const found = possiblePaths.find((p) => fs.existsSync(p));
  if (!found) {
    throw new Error(`KAFKA_CA_CERT_PATH specified (${caEnvPath}) but file not found`);
  }
  return fs.readFileSync(found, 'utf-8');
}

let kafkaInstance = null;
let sharedProducer = null;
let sharedAdmin = null;
const activeConsumers = [];

function getKafkaClient() {
  if (!kafkaInstance) {
    const brokers = (process.env.KAFKA_BROKERS || 'kafka-1defad13-smartmart-2026.k.aivencloud.com:21048')
      .split(',')
      .map((b) => b.trim());

    kafkaInstance = new Kafka({
      clientId: 'smartmart-backend',
      brokers,
      ssl: {
        ca: [getKafkaCaCert()],
        rejectUnauthorized: true
      },
      sasl: {
        mechanism: 'scram-sha-256',
        username: process.env.KAFKA_USERNAME || 'avnadmin',
        password: process.env.KAFKA_PASSWORD || ''
      },
      connectionTimeout: 8000
    });
  }
  return kafkaInstance;
}

function getProducer() {
  if (!sharedProducer) {
    const client = getKafkaClient();
    sharedProducer = client.producer({
      idempotent: true,
      acks: -1,
      retries: 5,
      requestTimeout: config.kafkaPublishTimeoutMs || 8000
    });
  }
  return sharedProducer;
}

async function connectProducer() {
  const producer = getProducer();
  await producer.connect();
  console.log('Kafka producer connected successfully');
  return producer;
}

async function getAdmin() {
  if (!sharedAdmin) {
    const client = getKafkaClient();
    sharedAdmin = client.admin();
    await sharedAdmin.connect();
  }
  return sharedAdmin;
}

function createConsumer(groupId) {
  const client = getKafkaClient();
  const consumer = client.consumer({
    groupId,
    fromBeginning: true,
    autoCommit: false
  });
  activeConsumers.push(consumer);
  return consumer;
}

const TOPICS = {
  OrderPlaced: 'order-events',
  StoreStockChanged: 'inventory-events'
};

async function kafkaHealthy() {
  try {
    const timeout = new Promise((_, reject) =>
      setTimeout(() => reject(new Error('Kafka health check timed out')), 8000)
    );
    const probe = (async () => {
      const admin = await getAdmin();
      await admin.describeCluster();
      return true;
    })();
    return await Promise.race([probe, timeout]);
  } catch (err) {
    // If existing connection had an issue, retry once with fresh admin
    try {
      if (sharedAdmin) {
        try { await sharedAdmin.disconnect(); } catch (e) {}
        sharedAdmin = null;
      }
      const client = getKafkaClient();
      sharedAdmin = client.admin();
      await sharedAdmin.connect();
      await sharedAdmin.describeCluster();
      return true;
    } catch (retryErr) {
      console.error('Kafka health check error:', retryErr.message);
      return false;
    }
  }
}

async function disconnectAll() {
  if (sharedAdmin) {
    try {
      await sharedAdmin.disconnect();
    } catch (e) {
      console.warn('Error disconnecting admin:', e.message);
    }
    sharedAdmin = null;
  }

  if (sharedProducer) {
    try {
      await sharedProducer.disconnect();
    } catch (e) {
      console.warn('Error disconnecting producer:', e.message);
    }
    sharedProducer = null;
  }

  for (const consumer of activeConsumers) {
    try {
      await consumer.disconnect();
    } catch (e) {
      console.warn('Error disconnecting consumer:', e.message);
    }
  }
  activeConsumers.length = 0;
}

module.exports = {
  getKafkaClient,
  getProducer,
  connectProducer,
  createConsumer,
  TOPICS,
  kafkaHealthy,
  disconnectAll
};
