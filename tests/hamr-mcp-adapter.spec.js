// hamr-mcp-adapter tests — Refs #3043
// Coverage: governance_bundle_fetch happy path, HAMR-down local fallback, all 5 tools registered,
// DPoP signing present on request, MEGINGJORD_HAMR_DISABLED bypass, local bundle schema contract.
'use strict';
const { test, expect } = require('@playwright/test');
const path = require('node:path');
const os = require('node:os');
const fs = require('node:fs');

const ADAPTER = require(path.resolve(__dirname, '..', 'scripts', 'global', 'hamr-mcp-adapter.js'));

// ── helpers ──────────────────────────────────────────────────────────────────

function makeFetch(status, body) {
  return async () => ({
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
  });
}

// ── tool registration ─────────────────────────────────────────────────────────

test('TOOLS array exposes the 5 required capabilities', () => {
  const names = ADAPTER.TOOLS.map((t) => t.name);
  expect(names).toContain('governance_bundle_fetch');
  expect(names).toContain('review_run');
  expect(names).toContain('bundle_fetch');
  expect(names).toContain('quota');
  expect(names).toContain('substrate_health');
  expect(names).toHaveLength(5);
});

test('each tool has a name, description, inputSchema, and handler', () => {
  for (const tool of ADAPTER.TOOLS) {
    expect(typeof tool.name).toBe('string');
    expect(typeof tool.description).toBe('string');
    expect(tool.inputSchema).toBeDefined();
    expect(typeof tool.handler).toBe('function');
  }
});

// ── DPoP signing ─────────────────────────────────────────────────────────────

test('buildSignedRequest produces authorization and dpop-sig headers', async () => {
  const { headers } = await ADAPTER.buildSignedRequest('test:cap', { foo: 1 });
  expect(headers.authorization).toMatch(/^DPoP /);
  expect(headers['x-hamr-dpop-sig']).toBeTruthy();
  expect(headers['x-hamr-pub-key']).toBeTruthy();
  expect(headers['content-type']).toBe('application/json');
});

// ── governance_bundle_fetch — happy path (HAMR available) ────────────────────

test('governance_bundle_fetch returns HAMR data with source: hamr', async () => {
  const mockBundle = { schema: 'governance-bundle/v1', issue: 42, fields: {}, content_hash: 'abc' };
  const fetchImpl = makeFetch(200, mockBundle);
  const tool = ADAPTER.TOOLS.find((t) => t.name === 'governance_bundle_fetch');
  const result = await tool.handler({ issue: 42 }, { fetchImpl });
  expect(result.source).toBe('hamr');
  expect(result.schema).toBe('governance-bundle/v1');
});

// ── governance_bundle_fetch — local fallback when HAMR down ──────────────────

test('governance_bundle_fetch falls back to local bundle when HAMR returns 500', async () => {
  const fetchImpl = makeFetch(500, { error: 'server error' });
  const tool = ADAPTER.TOOLS.find((t) => t.name === 'governance_bundle_fetch');
  const result = await tool.handler({ issue: 99 }, { fetchImpl });
  expect(result.source).toBe('local-fallback');
  expect(result.schema).toBe('governance-bundle/v1');
  expect(result.issue).toBe(99);
  expect(result.content_hash).toBeTruthy();
});

test('governance_bundle_fetch falls back to local bundle when fetch throws', async () => {
  const fetchImpl = async () => { throw new Error('ECONNREFUSED'); };
  const tool = ADAPTER.TOOLS.find((t) => t.name === 'governance_bundle_fetch');
  const result = await tool.handler({ issue: 7 }, { fetchImpl });
  expect(result.source).toBe('local-fallback');
  expect(result.schema).toBe('governance-bundle/v1');
});

// ── local bundle schema contract ──────────────────────────────────────────────

test('localBundleFallback returns valid governance-bundle v1 schema without snapshot file', () => {
  // No fields file exists for issue 0 — fallback should still produce a valid bundle
  const bundle = ADAPTER.localBundleFallback(0);
  expect(bundle.schema).toBe('governance-bundle/v1');
  expect(typeof bundle.content_hash).toBe('string');
  expect(bundle.content_hash).toHaveLength(64); // sha256 hex
  expect(bundle.source).toBe('local-fallback');
  expect(typeof bundle.generated_at).toBe('string');
});

test('localBundleFallback reads governance-fields snapshot when present', () => {
  const dir = path.join(os.homedir(), '.megingjord');
  fs.mkdirSync(dir, { recursive: true });
  const file = path.join(dir, 'governance-fields-9999.json');
  const fields = { checks_run: 5, checks_failed: 0, rubric_rating: 9 };
  fs.writeFileSync(file, JSON.stringify(fields), 'utf8');
  try {
    const bundle = ADAPTER.localBundleFallback(9999);
    expect(bundle.fields.checks_run).toBe(5);
    expect(bundle.fields.rubric_rating).toBe(9);
  } finally {
    fs.unlinkSync(file);
  }
});

// ── MEGINGJORD_HAMR_DISABLED bypass ──────────────────────────────────────────

test('review_run returns hamr-disabled when MEGINGJORD_HAMR_DISABLED=1', async () => {
  const orig = process.env.MEGINGJORD_HAMR_DISABLED;
  process.env.MEGINGJORD_HAMR_DISABLED = '1';
  try {
    // Re-require to pick up the new env value (module caches DISABLED at load time,
    // so we test via the inline check in each handler instead of module-level cache)
    const tool = ADAPTER.TOOLS.find((t) => t.name === 'review_run');
    // Pass a fetchImpl that would throw if called — verifies HAMR is never reached
    const fetchImpl = async () => { throw new Error('should not be called'); };
    const result = await tool.handler({ issue: 1 }, { fetchImpl });
    // With DISABLED=1 the module skips callHamr; governance_bundle_fetch uses local fallback
    // review_run returns { ok: false, reason: 'hamr-disabled' }
    expect(result.reason).toBe('hamr-disabled');
    expect(result.ok).toBe(false);
  } finally {
    if (orig === undefined) delete process.env.MEGINGJORD_HAMR_DISABLED;
    else process.env.MEGINGJORD_HAMR_DISABLED = orig;
  }
});

// ── callHamr error propagation ────────────────────────────────────────────────

test('callHamr throws a descriptive error when HAMR returns non-ok status', async () => {
  const fetchImpl = makeFetch(403, { error: 'forbidden' });
  await expect(ADAPTER.callHamr('test:cap', {}, { fetchImpl })).rejects.toThrow(/403/);
});

test('callHamr forwards parsed JSON on success', async () => {
  const payload = { ok: true, data: 'test' };
  const fetchImpl = makeFetch(200, payload);
  const result = await ADAPTER.callHamr('bundle:fetch', { key: 'k' }, { fetchImpl });
  expect(result).toEqual(payload);
});
