'use strict';
// Epic #3126 / #3803 — STRESS coverage for the fleet-dispatch substrate.
// Required by test-methodology-matrix: this surface is concurrency-sensitive (per-host
// serialization), state-mutating (JSONL append), and parses untrusted input (registry +
// panel data). Asserts >=1 chaos/fault-injection path (G6) and >=1 p99 latency budget (G7).
const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const registry = require('../scripts/global/fleet-registry');
const optimizer = require('../scripts/global/fleet-resource-optimizer');
const honestStop = require('../scripts/global/consensus-honest-stop');
const roi = require('../scripts/global/fleet-roi-telemetry');
const preflight = require('../scripts/global/fleet-preflight');

const RTL = '\u202E'; // right-to-left override — exotic char kept as an escape, never a literal

function p99(samples) {
  const s = [...samples].sort((a, b) => a - b);
  return s[Math.min(s.length - 1, Math.floor(s.length * 0.99))];
}

// ---------- G6: chaos / fault injection ----------
test('CHAOS: adversarial host configs never throw and never yield an unusable host', () => {
  const hostile = [
    null, undefined, 42, 'string', [], {},
    { id: 'no-url' },
    { url: 'not-a-url', id: 'bad-scheme' },
    { id: 'js', url: 'javascript:alert(1)' },
    { id: 'neg', url: 'http://ok:11434', max_concurrency: -99 },
    { id: 'huge', url: 'http://ok:11434', max_concurrency: Number.MAX_SAFE_INTEGER },
    { id: 'nan', url: 'http://ok:11434', max_concurrency: NaN },
    { id: 'fam', url: 'http://ok:11434', families: 'not-an-array' },
    { id: `unicode${RTL}rtl`, url: 'http://ok:11434' },
  ];
  for (const h of hostile) {
    assert.doesNotThrow(() => {
      if (registry.isValidHost(h)) {
        const n = registry.normalizeHost(h);
        assert.ok(n.max_concurrency >= 1, 'concurrency never < 1');
        assert.ok(Array.isArray(n.families), 'families always an array');
        assert.match(n.url, /^https?:\/\//, 'only http(s) hosts survive validation');
      }
    }, 'hostile host threw');
  }
});

test('CHAOS: prototype-pollution attempt via host config does not leak', () => {
  const evil = JSON.parse('{"id":"x","url":"http://x:11434","__proto__":{"pwned":true}}');
  if (registry.isValidHost(evil)) registry.normalizeHost(evil);
  assert.strictEqual({}.pwned, undefined, 'Object.prototype not polluted');
});

test('CHAOS: adversarial panel entries never throw the optimizer', () => {
  const hostile = [
    {}, { tier: 'local' }, { quality: 'abc' }, { quality: NaN },
    { quality: Infinity }, { quality: -5 }, { quality: 99 },
    { model: 'x', tier: 'local', timeout_ms: -1 },
    { model: 'x', tier: 'local', timeout_ms: 'soon' },
    { provider: `${RTL}rtl`, tier: 'premium', quality: 1 },
    { model: { nested: 'obj' }, tier: 'local' },
  ];
  assert.doesNotThrow(() => {
    const ranked = optimizer.rankResources(hostile, { taskClass: 'standard' });
    assert.ok(Array.isArray(ranked));
  });
  assert.doesNotThrow(() => optimizer.selectOptimal(hostile, {}));
  assert.doesNotThrow(() => optimizer.selectDiversePanel(hostile, 3));
});

test('CHAOS/G3: no adversarial quality value can smuggle a paid pick past a free one', () => {
  // A hostile panel claims absurd quality for the paid model; free must still win.
  const panel = [
    { provider: 'ollama:a', model: 'qwen2.5-coder:32b', tier: 'local' },
    { provider: 'evil-paid', family: 'x', tier: 'premium', quality: 9999 },
  ];
  const pick = optimizer.selectOptimal(panel, { taskClass: 'standard' });
  assert.strictEqual(pick.tier, 'local', 'clamped quality cannot buy a paid escalation');
});

test('CHAOS: honest-stop survives adversarial panels and gates', () => {
  const gates = [NaN, Infinity, -1, 0, 1e9, 'ninety', null, undefined];
  for (const g of gates) {
    assert.doesNotThrow(() => honestStop.evaluateGate([{ family: 'qwen' }, { family: 'llama' }], g));
  }
  assert.doesNotThrow(() => honestStop.evaluateGate(null, 93));
  assert.doesNotThrow(() => honestStop.evaluateGate([{}, {}], 93));
  assert.strictEqual(honestStop.evaluateGate([{}, {}], 93).stop_reason, 'no_usable_panel');
});

test('CHAOS: honest-stop always terminates — no unbounded iteration under any input', () => {
  const panel = [{ family: 'qwen' }, { family: 'deepseek' }, { family: 'llama' }];
  let iterations = 0;
  let state = { panel, gate: 93, iterations: 0, prevScore: null, lastScore: null };
  while (honestStop.shouldIterate(state, { maxIterations: 3 }).iterate) {
    iterations += 1;
    state = { ...state, iterations, prevScore: 85, lastScore: 85 };
    assert.ok(iterations <= 5, 'loop failed to terminate');
  }
  assert.ok(iterations <= 3, 'stopped within the iteration cap');
});

test('CHAOS: preflight tolerates a fetch that throws or returns garbage', async () => {
  const cases = [
    async () => { throw new Error('boom'); },
    async () => ({ ok: true, json: async () => { throw new Error('bad json'); } }),
    async () => ({ ok: true, json: async () => ({ models: 'not-an-array' }) }),
    async () => ({ ok: true, json: async () => null }),
    async () => ({ ok: false, status: 500 }),
    async () => null,
  ];
  for (const fetchImpl of cases) {
    const r = await preflight.fleetPreflight({
      hosts: [{ id: 'h', url: 'http://h', families: [], max_concurrency: 1 }],
      fetchImpl, env: {},
    });
    assert.ok(Array.isArray(r.usable), 'always returns a usable array');
  }
});

test('CHAOS: a hanging host is aborted by the probe timeout (never hangs the run)', async () => {
  const fetchImpl = (url, { signal }) => new Promise((_res, rej) => {
    signal.addEventListener('abort', () => rej(Object.assign(new Error('aborted'), { name: 'AbortError' })));
  });
  const t0 = Date.now();
  const r = await preflight.probeHost({ id: 'slow', url: 'http://slow', families: [] }, fetchImpl, 200);
  assert.strictEqual(r.reachable, false);
  assert.strictEqual(r.reason, 'timeout');
  assert.ok(Date.now() - t0 < 2000, 'probe aborted promptly');
});

// ---------- concurrency / state mutation ----------
test('STRESS: concurrent ROI appends do not interleave or corrupt lines', async () => {
  const file = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'roi-stress-')), 'roi.jsonl');
  const N = 200;
  await Promise.all(Array.from({ length: N }, (_v, i) =>
    Promise.resolve().then(() => roi.recordRun({ free_calls: i, ticket: 3803 }, { file }))));
  const lines = fs.readFileSync(file, 'utf8').trim().split('\n');
  assert.strictEqual(lines.length, N, 'every append landed');
  for (const l of lines) assert.doesNotThrow(() => JSON.parse(l), 'no torn/interleaved line');
});

test('STRESS: registry stays correct under repeated concurrent loads', async () => {
  const results = await Promise.all(Array.from({ length: 100 }, () =>
    Promise.resolve().then(() => registry.loadHosts().length)));
  assert.strictEqual(new Set(results).size, 1, 'host count is stable under concurrent load');
});

// ---------- G7: p99 latency budgets ----------
test('PERF/G7: optimizer selection p99 < 15ms on a 200-candidate panel', () => {
  const panel = Array.from({ length: 200 }, (_v, i) => ({
    provider: `p${i}`, model: i % 2 ? 'qwen2.5-coder:32b' : 'deepseek-coder-v2:lite',
    tier: i % 3 ? 'local' : 'premium', family: `fam${i % 7}`, quality: (i % 10) / 10,
  }));
  const samples = [];
  for (let i = 0; i < 100; i += 1) {
    const t0 = process.hrtime.bigint();
    optimizer.selectOptimal(panel, { taskClass: 'standard' });
    samples.push(Number(process.hrtime.bigint() - t0) / 1e6);
  }
  const budget = p99(samples);
  assert.ok(budget < 15, `p99 selection ${budget.toFixed(2)}ms exceeded 15ms budget`);
});

test('PERF/G7: capability lookup p99 < 2ms (hot path, called per dispatch)', () => {
  const caps = registry.loadCapabilities();
  const samples = [];
  for (let i = 0; i < 500; i += 1) {
    const t0 = process.hrtime.bigint();
    registry.capabilityFor(i % 2 ? 'qwen3:32b' : 'unknown:1b', caps);
    samples.push(Number(process.hrtime.bigint() - t0) / 1e6);
  }
  const budget = p99(samples);
  assert.ok(budget < 2, `p99 capability lookup ${budget.toFixed(3)}ms exceeded 2ms budget`);
});

test('PERF/G7: honest-stop evaluation p99 < 2ms', () => {
  const panel = Array.from({ length: 50 }, (_v, i) => ({ family: `f${i % 5}` }));
  const samples = [];
  for (let i = 0; i < 200; i += 1) {
    const t0 = process.hrtime.bigint();
    honestStop.evaluateGate(panel, 93);
    samples.push(Number(process.hrtime.bigint() - t0) / 1e6);
  }
  const budget = p99(samples);
  assert.ok(budget < 2, `p99 gate eval ${budget.toFixed(3)}ms exceeded 2ms budget`);
});
