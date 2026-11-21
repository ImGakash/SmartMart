const fs = require('fs');
const path = require('path');
const tls = require('tls');
const { Client } = require('@opensearch-project/opensearch');
require('dotenv').config({ path: path.resolve(__dirname, '../../.env') });

function getOpenSearchCaCert() {
  const caEnvPath = process.env.OPENSEARCH_CA_CERT_PATH || 'ca.pem';
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
    throw new Error(`OPENSEARCH_CA_CERT_PATH specified (${caEnvPath}) but file not found`);
  }
  return fs.readFileSync(found, 'utf-8');
}

const caCert = getOpenSearchCaCert();
// Combine system root CAs (for Let's Encrypt certificates) with custom project CA
const sslCa = [...tls.rootCertificates, caCert];

const client = new Client({
  node: process.env.OPENSEARCH_URL,
  auth: {
    username: process.env.OPENSEARCH_USERNAME || 'avnadmin',
    password: process.env.OPENSEARCH_PASSWORD || ''
  },
  ssl: {
    ca: sslCa,
    rejectUnauthorized: true
  }
});

async function osHealthy() {
  try {
    const timeout = new Promise((_, reject) =>
      setTimeout(() => reject(new Error('OpenSearch health check timed out')), 4000)
    );
    const probe = (async () => {
      const res = await client.cluster.health();
      const status = res.body?.status;
      return status === 'green' || status === 'yellow';
    })();
    return await Promise.race([probe, timeout]);
  } catch (err) {
    return false;
  }
}

module.exports = {
  client,
  osHealthy
};
