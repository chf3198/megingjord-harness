'use strict';

const assert = require('node:assert/strict');
const { test } = require('node:test');
const { runSmoke, classifyFailure, TOOL_CASES } = require('../scripts/global/tavily-smoke.js');

test('dry-run succeeds and includes all four tool probes', async () => {
  const out = await runSmoke();
  assert.equal(out.ok, true);
  assert.equal(out.mode, 'dry-run');
  assert.deepEqual(out.tools.map((t) => t.tool), TOOL_CASES.map((t) => t.tool));
});

test('live mode fails deterministically when API key is missing', async () => {
  const out = await runSmoke({ live: true, apiKey: '' });
  assert.equal(out.ok, false);
  assert.equal(out.error, 'missing-api-key');
  assert.match(out.remediation, /TAVILY_API_KEY/);
});

test('live mode returns per-tool failure classifications', async () => {
  const fakeFetch = async (url) => ({ ok: false, status: url.includes('/search') ? 429 : 404 });
  const out = await runSmoke({ live: true, apiKey: 'k', fetchImpl: fakeFetch });
  assert.equal(out.ok, false);
  assert.equal(out.tools.length, 4);
  assert.equal(out.tools[0].error, 'rate-limited');
  assert.equal(out.tools[1].error, 'tool-unreachable');
});

test('classifyFailure maps key HTTP statuses to actionable reasons', () => {
  assert.equal(classifyFailure(401).code, 'auth-failed');
  assert.equal(classifyFailure(404).code, 'tool-unreachable');
  assert.equal(classifyFailure(429).code, 'rate-limited');
  assert.equal(classifyFailure(503).code, 'provider-error');
});
