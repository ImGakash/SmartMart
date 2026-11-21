const { Kafka, Partitioners } = require('kafkajs');
const path = require('path');
const fs = require('fs');
require('dotenv').config({ path: path.resolve(__dirname, '../../.env') });

const brokers = (process.env.KAFKA_BROKERS || '').split(',').filter(Boolean);
const authMode = (process.env.KAFKA_AUTH_MODE || 'sasl').toLowerCase();

function getKafkaConfig() {
  const kafkaConfig = {
    clientId: process.env.KAFKA_CLIENT_ID || 'smartmart-backend',
    brokers,
    connectionTimeout: 10000,
    requestTimeout: 25000
  };

  const ssl = {};
  if (process.env.KAFKA_CA_CERT_PATH) {
    const caPath = path.resolve(process.env.KAFKA_CA_CERT_PATH);
    if (fs.existsSync(caPath)) {
      ssl.ca = [fs.readFileSync(caPath, 'utf-8')];
    }
  }

  if (authMode === 'sasl') {
    kafkaConfig.ssl = Object.keys(ssl).length > 0 ? ssl : true;
    kafkaConfig.sasl = {
      mechanism: 'scram-sha-256',
      username: process.env.KAFKA_USERNAME || 'avnadmin',
      password: process.env.KAFKA_PASSWORD || ''
    };
  } else if (authMode === 'mtls') {
    if (process.env.KAFKA_CERT_PATH) {
      const certPath = path.resolve(process.env.KAFKA_CERT_PATH);
      if (fs.existsSync(certPath)) ssl.cert = fs.readFileSync(certPath, 'utf-8');
    }
    if (process.env.KAFKA_KEY_PATH) {
      const keyPath = path.resolve(process.env.KAFKA_KEY_PATH);
      if (fs.existsSync(keyPath)) ssl.key = fs.readFileSync(keyPath, 'utf-8');
    }
    kafkaConfig.ssl = ssl;
  }

  return kafkaConfig;
}

const kafka = new Kafka(getKafkaConfig());

const producer = kafka.producer({
  createPartitioner: Partitioners.LegacyPartitioner,
  idempotent: true,
  retry: { retries: 5 }
});

const createConsumer = (groupId) => {
  return kafka.consumer({
    groupId,
    fromBeginning: false,
    autoCommit: false 
  });
};

module.exports = {
  producer,
  createConsumer
};