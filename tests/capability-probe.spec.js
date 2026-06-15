// Tests for Phase 0 capability probe + show (#788)
const { test, expect } = require('@playwright/test');
const fs = require('fs');
const path = require('path');
const os = require('os');

const PROBE = '../scripts/global/capability-probe';
const SHOW = '../scripts/global/capability-show';

let originalCwd;
let tmpDir;

test.beforeEach(() => {
  originalCwd = process.cwd();
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'cap-test-'));
  fs.mkdirSync(path.join(tmpDir, 'inventory'), { recursive: true });
  fs.writeFileSync(
    path.join(tmpDir, 'inventory', 'devices.json'),
    JSON.stringify({ devices: [] }),
  );
  process.chdir(tmpDir);
  delete require.cache[require.resolve(PROBE)];
  delete require.cache[require.resolve(SHOW)];
});

test.afterEach(() => {
  process.chdir(originalCwd);
});

test('probe writes manifest with required schema fields', async () => {
  const { probe } = require(PROBE);
  const manifest = await probe();
  expect(manifest.schema_version).toBe(2);
  expect(manifest.probed_at).toBeTruthy();
  expect(manifest).toHaveProperty('tailscale');
  expect(manifest).toHaveProperty('fleet');
  expect(manifest).toHaveProperty('cloudflare');
  expect(manifest).toHaveProperty('providers');
  expect(manifest).toHaveProperty('mcp');
});

test('validateCapabilityManifest accepts the probe manifest and rejects stale schema', async () => {
  const { probe, validateCapabilityManifest } = require(PROBE);
  const manifest = await probe();
  expect(validateCapabilityManifest(manifest)).toBe(manifest);
  expect(() => validateCapabilityManifest({
    probed_at: new Date().toISOString(), schema_version: 1,
    tailscale: {}, fleet: {}, cloudflare: {}, providers: {}, mcp: {},
  })).toThrow(/schema_version must be 2/);
});

test('validateCapabilityManifest rejects malformed nested capability sections', async () => {
  const { validateCapabilityManifest } = require(PROBE);
  expect(() => validateCapabilityManifest({
    probed_at: new Date().toISOString(), schema_version: 2,
    tailscale: {}, fleet: {}, cloudflare: { account: null }, providers: {}, mcp: {}, r2: {}, wrangler: {}, github_oidc: {}, npm_trusted_publishing: {},
  })).toThrow(/cloudflare.account must be an object/);
  expect(() => validateCapabilityManifest({
    probed_at: new Date().toISOString(), schema_version: 2,
    tailscale: {}, fleet: {}, cloudflare: { account: {} }, providers: {}, mcp: { rag_server: null }, r2: {}, wrangler: {}, github_oidc: {}, npm_trusted_publishing: {},
  })).toThrow(/mcp.rag_server must be an object/);
  expect(() => validateCapabilityManifest({
    probed_at: new Date().toISOString(), schema_version: 2,
    tailscale: {}, fleet: {}, cloudflare: { account: {} }, providers: [], mcp: { rag_server: {} }, r2: {}, wrangler: {}, github_oidc: {}, npm_trusted_publishing: {},
  })).toThrow(/providers must be an object/);
});

test('probe is read-only — does not mutate inventory', async () => {
  const { probe } = require(PROBE);
  const before = fs.readFileSync(path.join(tmpDir, 'inventory', 'devices.json'), 'utf8');
  await probe();
  const after = fs.readFileSync(path.join(tmpDir, 'inventory', 'devices.json'), 'utf8');
  expect(after).toBe(before);
});

test('probe gracefully handles missing tailscale binary', async () => {
  const { probeTailscale } = require(PROBE);
  process.env.PATH = '/nonexistent';
  const result = probeTailscale();
  expect(result.available).toBe(false);
});

test('probe handles missing provider env vars', async () => {
  const { probeProvider, PROVIDER_PROBES } = require(PROBE);
  const fake = { ...PROVIDER_PROBES[0] };
  const result = await probeProvider(fake, {});
  expect(result.available).toBe(false);
  expect(result.reason).toBe('no-key');
});

test('show returns 1 when manifest missing, 0 when present', async () => {
  const { show } = require(SHOW);
  expect(show()).toBe(1);
  fs.mkdirSync(path.join(tmpDir, '.dashboard'), { recursive: true });
  fs.writeFileSync(path.join(tmpDir, '.dashboard', 'capabilities.json'), JSON.stringify({
    probed_at: new Date().toISOString(), schema_version: 2,
    tailscale: { available: false }, fleet: {}, cloudflare: { account: { available: false } },
    providers: {}, mcp: { rag_server: { reachable: false } }, r2: {}, wrangler: {}, github_oidc: {}, npm_trusted_publishing: {},
  }));
  delete require.cache[require.resolve(SHOW)];
  const { show: show2 } = require(SHOW);
  expect(show2()).toBe(0);
});

test('show returns 1 on malformed capability manifest (fail closed)', async () => {
  fs.mkdirSync(path.join(tmpDir, '.dashboard'), { recursive: true });
  fs.writeFileSync(path.join(tmpDir, '.dashboard', 'capabilities.json'), JSON.stringify({
    probed_at: new Date().toISOString(), schema_version: 1,
    tailscale: { available: false }, fleet: {}, cloudflare: { account: { available: false } },
    providers: {}, mcp: { rag_server: { reachable: false } }, r2: {}, wrangler: {}, github_oidc: {}, npm_trusted_publishing: {},
  }));
  delete require.cache[require.resolve(SHOW)];
  const { show: show2 } = require(SHOW);
  expect(show2()).toBe(1);
});

test('tierAvailability reflects substrate state', async () => {
  const { tierAvailability } = require(SHOW);
  const offResult = tierAvailability({
    tailscale: { available: false }, fleet: {},
    cloudflare: { account: { available: false } },
    providers: {}, mcp: { rag_server: { reachable: false } },
  });
  expect(offResult['Tier 0 — AI Gateway cache (Phase 1)']).toBe(false);
  const onResult = tierAvailability({
    fleet: { h1: { reachable: true } },
    cloudflare: { account: { available: true } },
    providers: { groq: { available: true } },
    mcp: { rag_server: { reachable: false } },
  });
  expect(onResult['Tier 0 — AI Gateway cache (Phase 1)']).toBe(true);
  expect(onResult['Tier 1 — Free orchestrator (Phase 4)']).toBe(true);
  expect(onResult['Tier 2 — RAG MCP (Phase 2)']).toBe(true);
});
