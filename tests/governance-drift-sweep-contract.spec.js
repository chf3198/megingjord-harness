const { test } = require('node:test');
const assert = require('node:assert/strict');
const { buildReport } = require('../scripts/global/governance-drift-sweep');

test('contract report includes required top-level keys', () => {
  const report = buildReport([]);
  assert.equal(report.mode, 'scan');
  assert.equal(report.route, 'deterministic');
  assert.equal(report.premiumLaneProhibited, true);
  assert.ok(report.counts && typeof report.counts === 'object');
  assert.ok(report.details && typeof report.details === 'object');
});
