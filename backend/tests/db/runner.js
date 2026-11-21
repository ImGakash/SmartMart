const { pool, resetDemo } = require('../../src/db');
const { runTestA } = require('./test-a');
const { runTestB } = require('./test-b');
const { runTestC } = require('./test-c');
const { runTestD } = require('./test-d');
const { runTestE } = require('./test-e');
const { runTestF } = require('./test-f');
const { runTestG } = require('./test-g');
const { runTestH } = require('./test-h');
const { runTestI } = require('./test-i');
const { runOutboxLifecycleTests } = require('./test-outbox-lifecycle');
const { runVerifySearchDocs } = require('./verify-search-docs');

async function runAll() {
  console.log('================================================================');
  console.log('   SMARTMART DATABASE ACCEPTANCE TEST SUITE (§15 TESTS A - I)   ');
  console.log('================================================================\n');

  const tests = [
    { id: 'A', name: 'Stock=1, 50 Concurrent Buyers', fn: runTestA },
    { id: 'B', name: 'Stock=10, 50 Concurrent Buyers', fn: runTestB },
    { id: 'C', name: 'Multi-Item Rollback', fn: runTestC },
    { id: 'D', name: 'POS vs Online Race (Stock=1)', fn: runTestD },
    { id: 'E', name: 'Idempotency Key Dedup (Seq & Conc)', fn: runTestE },
    { id: 'F', name: 'Notification Consumer Dedup', fn: runTestF },
    { id: 'G', name: 'Relay Crash Recovery & Reclaim', fn: runTestG },
    { id: 'H', name: 'Database Constraints Verification', fn: runTestH },
    { id: 'I', name: 'Pool Concurrency Race (<30s)', fn: runTestI },
    { id: 'Lifecycle', name: 'Outbox Lifecycle Verification', fn: runOutboxLifecycleTests },
    { id: 'SearchDocs', name: 'Search Document Structure (36 docs)', fn: runVerifySearchDocs }
  ];

  const results = [];

  for (const t of tests) {
    console.log(`>>> Running Test [${t.id}]: ${t.name}...`);
    const start = Date.now();
    let passed = false;
    let error = null;
    try {
      passed = await t.fn();
    } catch (err) {
      error = err.message;
      console.error(`Error in test ${t.id}:`, err);
    }
    const durationMs = Date.now() - start;
    results.push({ id: t.id, name: t.name, passed, durationMs, error });
    console.log(`>>> Finished [${t.id}] in ${durationMs}ms: ${passed ? 'PASS' : 'FAIL'}\n`);
    // Reset between tests
    await resetDemo();
  }

  console.log('================================================================');
  console.log('                   FINAL ACCEPTANCE TEST MATRIX                 ');
  console.log('================================================================');
  console.log('| Test | Name                               | Status | Duration |');
  console.log('|------|------------------------------------|--------|----------|');
  let allPass = true;
  for (const r of results) {
    if (!r.passed) allPass = false;
    const id = r.id.padEnd(4);
    const name = r.name.padEnd(34);
    const status = r.passed ? 'PASS  ' : 'FAIL  ';
    const dur = `${r.durationMs}ms`.padStart(8);
    console.log(`| ${id} | ${name} | ${status} | ${dur} |`);
  }
  console.log('================================================================');
  console.log(`OVERALL RESULT: ${allPass ? 'ALL TESTS PASSED 100%' : 'SOME TESTS FAILED'}`);

  await pool.end();
  process.exit(allPass ? 0 : 1);
}

if (require.main === module) {
  runAll().catch((err) => {
    console.error('Test runner fatal error:', err);
    pool.end();
    process.exit(1);
  });
}

module.exports = { runAll };
