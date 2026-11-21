const fs = require('fs');
const path = require('path');
const https = require('https');
require('dotenv').config({ path: path.resolve(__dirname, '../../.env') });

const opensearchUrl = process.env.OPENSEARCH_URL || '';
const username = process.env.OPENSEARCH_USERNAME || 'avnadmin';
const password = process.env.OPENSEARCH_PASSWORD || '';
const caCertPath = process.env.OPENSEARCH_CA_CERT_PATH || process.env.KAFKA_CA_CERT_PATH || '';

let httpsAgent = null;
if (caCertPath && fs.existsSync(caCertPath)) {
  const ca = fs.readFileSync(caCertPath, 'utf8');
  httpsAgent = new https.Agent({ ca, rejectUnauthorized: true });
} else {
  httpsAgent = new https.Agent({ rejectUnauthorized: false });
}

/**
 * Low-level HTTP request helper for OpenSearch REST API.
 */
function request(method, endpoint, body = null) {
  return new Promise((resolve, reject) => {
    if (!opensearchUrl) {
      return reject(new Error('OPENSEARCH_URL is not configured in .env'));
    }

    const url = new URL(endpoint.startsWith('/') ? endpoint : `/${endpoint}`, opensearchUrl);
    const auth = Buffer.from(`${username}:${password}`).toString('base64');

    const headers = {
      Authorization: `Basic ${auth}`,
      'Content-Type': 'application/json'
    };

    let postData = null;
    if (body !== null) {
      postData = typeof body === 'string' ? body : JSON.stringify(body);
      headers['Content-Length'] = Buffer.byteLength(postData);
    }

    const options = {
      protocol: url.protocol,
      hostname: url.hostname,
      port: url.port || 443,
      path: url.pathname + url.search,
      method,
      headers,
      agent: httpsAgent,
      timeout: 10000
    };

    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => (data += chunk));
      res.on('end', () => {
        try {
          const parsed = data ? JSON.parse(data) : {};
          if (res.statusCode >= 200 && res.statusCode < 300) {
            resolve(parsed);
          } else {
            const err = new Error(`OpenSearch HTTP ${res.statusCode}: ${data}`);
            err.statusCode = res.statusCode;
            err.response = parsed;
            reject(err);
          }
        } catch (e) {
          if (res.statusCode >= 200 && res.statusCode < 300) {
            resolve(data);
          } else {
            reject(new Error(`OpenSearch HTTP ${res.statusCode}: ${data}`));
          }
        }
      });
    });

    req.on('timeout', () => {
      req.destroy();
      reject(new Error('OpenSearch request timed out'));
    });

    req.on('error', reject);

    if (postData) {
      req.write(postData);
    }
    req.end();
  });
}

module.exports = {
  request,
  opensearchUrl
};
