const { Client } = require('@opensearch-project/opensearch');
const fs = require('fs');

let tls = { rejectUnauthorized: false };
if (process.env.OPENSEARCH_CA_CERT_PATH) {
  try {
    if (fs.existsSync(process.env.OPENSEARCH_CA_CERT_PATH)) {
      const cert = fs.readFileSync(process.env.OPENSEARCH_CA_CERT_PATH);
      tls = {
        ca: [cert],
        rejectUnauthorized: true
      };
    }
  } catch (err) {
    tls = { rejectUnauthorized: false };
  }
}

const client = new Client({
  node: process.env.OPENSEARCH_URL || 'http://localhost:9200',
  auth: {
    username: process.env.OPENSEARCH_USERNAME,
    password: process.env.OPENSEARCH_PASSWORD
  },
  tls
});

async function ping() {
  try {
    const response = await client.info();
    const version = response.body?.version?.number || response.version?.number || 'unknown';
    console.log(`✅ OpenSearch connected: ${version}`);
    return true;
  } catch (err) {
    console.error('❌ OpenSearch connection failed:', err.message || err);
    return false;
  }
}

module.exports = {
  client,
  ping
};
