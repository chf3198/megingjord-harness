'use strict';
// Epic #3126 / #3803 — unit coverage for the fleet-dispatch substrate (AC1-AC6).
const test = require('node:test');
const assert = require('node:assert');
const path = require('node:path');
const fs = require('node:fs');
const os = require('node:os');

const registry = require('../scripts/global/fleet-registry');
const optimizer = require('../scripts/global/fleet-resource-optimizer');
const honestStop = require('../scripts/global/consensus-honest-stop');
const roi = require('../scripts/global/fleet-roi-telemetry');
const preflight = require('../scripts/global/fleet-preflight');
const ollama = require('../scripts/global/ollama-direct');

// ---------- AC2: settings-driven multi-host ----------
test('AC2: host list loads from config with both fleet hosts', () => {
  const hosts = registry.loadHosts();
  assert.ok(hosts.length >= 2, 'expected >=2 configured hosts');
  assert.ok(hosts.every((h) => /^https?:\/\//.test(h.url)), 'every host has a url');
  assert.ok(hosts.some((h) => h.families.includes('deepseek')), 'host B carries the deepseek family');
});

test('AC2/G5: MEGINGJORD_FLEET_HOSTS env overrides config (no user-specific coupling)', () => {
  const prev = process.env.MEGINGJORD_FLEET_HOSTS;
  process.env.MEGINGJORD_FLEET_HOSTS = JSON.stringify([{ id: 'x', url: 'http://example:11434', families: ['qwen'] }]);
  try {
    const hosts = registry.loadHosts();
    assert.strictEqual(hosts.length, 1);
    assert.strictEqual(hosts[0].url, 'http://example:11434');
  } finally { if (prev === undefined) delete process.env.MEGINGJORD_FLEET_HOSTS; else process.env.MEGINGJORD_FLEET_HOSTS = prev; }
});

test('AC2/G5: comma-separated URL list form is accepted', () => {
  const prev = process.env.MEGINGJORD_FLEET_HOSTS;
  process.env.MEGINGJORD_FLEET_HOSTS = 'http://a:11434, http://b:11434';
  try {
    const hosts = registry.loadHosts();
    assert.strictEqual(hosts.length, 2);
  } finally { if (prev === undefined) delete process.env.MEGINGJORD_FLEET_HOSTS; else process.env.MEGINGJORD_FLEET_HOSTS = prev; }
});

test('AC2/G6: malformed host config degrades to empty, never throws', () => {
  const prev = process.env.FLEET_HOSTS_PATH;
  process.env.FLEET_HOSTS_PATH = '/nonexistent/never/fleet-hosts.json';
  try {
    assert.deepStrictEqual(registry.loadHosts(), []);
  } finally { if (prev === undefined) delete process.env.FLEET_HOSTS_PATH; else process.env.FLEET_HOSTS_PATH = prev; }
});

test('AC2: max_concurrency clamps to >=1 so a bad config cannot deadlock a scheduler', () => {
  assert.strictEqual(registry.normalizeHost({ id: 'a', url: 'http://a', max_concurrency: 0 }).max_concurrency, 1);
  assert.strictEqual(registry.normalizeHost({ id: 'a', url: 'http://a', max_concurrency: -5 }).max_concurrency, 1);
});

test('AC2: model routes to the host that declares its family, with others as failover', () => {
  const prevEnv = process.env.OLLAMA_URL; delete process.env.OLLAMA_URL;
  try {
    const hosts = ollama.resolveHostsForModel('deepseek-coder-v2:lite');
    assert.ok(hosts.length >= 2, 'failover hosts retained');
    assert.match(hosts[0], /100\.78\.22\.13/, 'deepseek resolves to host B first');
    const qwen = ollama.resolveHostsForModel('qwen2.5-coder:32b');
    assert.match(qwen[0], /100\.91\.113\.16/, 'qwen resolves to host A first');
  } finally { if (prevEnv !== undefined) process.env.OLLAMA_URL = prevEnv; }
});

test('AC2: explicit OLLAMA_URL still wins (back-compat)', () => {
  const prev = process.env.OLLAMA_URL;
  process.env.OLLAMA_URL = 'http://legacy:11434';
  try {
    assert.deepStrictEqual(ollama.resolveHostsForModel('deepseek-coder-v2:lite'), ['http://legacy:11434']);
  } finally { if (prev === undefined) delete process.env.OLLAMA_URL; else process.env.OLLAMA_URL = prev; }
});

// ---------- AC3: capability registry ----------
test('AC3: thinking model gets think:false and a cold-load-sized timeout', () => {
  const cap = registry.capabilityFor('qwen3:32b');
  assert.strictEqual(cap.thinking, true);
  assert.ok(cap.timeout_ms >= 600000, 'qwen3:32b budget covers ~1.5 tok/s + 64s cold load');
  const opts = ollama.optionsForModel('qwen3:32b');
  assert.strictEqual(opts.think, false, 'dispatcher disables thinking to avoid empty content');
});

test('AC3: non-thinking model does not set think', () => {
  assert.strictEqual(ollama.optionsForModel('qwen2.5-coder:32b').think, undefined);
});

test('AC3: unknown model resolves to the default profile (never undefined)', () => {
  const cap = registry.capabilityFor('totally-made-up:99b');
  assert.strictEqual(cap.family, 'unknown');
  assert.ok(cap.timeout_ms > 0, 'a timeout always exists');
});

test('AC3: tag drift resolves to the base profile', () => {
  assert.strictEqual(registry.capabilityFor('qwen3:32b-q4_K_M').family, 'qwen');
});

test('AC3/G2: an UNREGISTERED model is dispatchable but never a judge (xfam review finding)', () => {
  // deepseek-coder-v2 cross-family review (#3803): an undeclared model defaulting to
  // quality 0.5 could silently become a final judge. Fail-open on availability (it still
  // dispatches), fail-closed on authority (it cannot judge).
  const cap = registry.capabilityFor('totally-unregistered:99b');
  assert.strictEqual(cap.judge_eligible, false, 'undeclared model must not judge');
  assert.ok(cap.timeout_ms > 0, 'but it is still dispatchable');
  const jury = optimizer.selectDiversePanel(
    [{ provider: 'x', model: 'totally-unregistered:99b', tier: 'local' },
     { provider: 'y', model: 'qwen2.5-coder:32b', tier: 'local' }], 2);
  assert.ok(jury.every((c) => c.model !== 'totally-unregistered:99b'), 'unknown model excluded from jury');
});

test('AC3: 3b models are not judge-eligible (falsely-inflated scores)', () => {
  assert.strictEqual(registry.capabilityFor('granite-code:3b').judge_eligible, false);
  assert.strictEqual(registry.capabilityFor('qwen2.5-coder:32b').judge_eligible, true);
});

// ---------- AC6: goal-weighted optimizer ----------
const PANEL = [
  { provider: 'ollama:a', model: 'qwen2.5-coder:32b', tier: 'local' },
  { provider: 'ollama:b', model: 'deepseek-coder-v2:lite', tier: 'local' },
  { provider: 'ollama:b', model: 'granite-code:3b', tier: 'local' },
  { provider: 'groq', family: 'llama', tier: 'free-cloud', quality: 0.6, timeout_ms: 45000 },
  { provider: 'anthropic', family: 'claude', tier: 'premium', quality: 0.95, timeout_ms: 30000 },
];

test('AC6/G3: a free adequate model beats a higher-quality PAID model', () => {
  const pick = optimizer.selectOptimal(PANEL, { taskClass: 'standard' });
  assert.strictEqual(pick.tier, 'local', 'must not escalate to paid when a free option is adequate');
  assert.strictEqual(pick.escalate, false);
  assert.notStrictEqual(pick.provider, 'anthropic');
});

test('AC6/G3: paid escalation only when NO free candidate clears the bar, and is reported', () => {
  const paidOnly = [
    { provider: 'ollama:b', model: 'granite-code:3b', tier: 'local' },
    { provider: 'anthropic', family: 'claude', tier: 'premium', quality: 0.95 },
  ];
  const pick = optimizer.selectOptimal(paidOnly, { taskClass: 'high-stakes' });
  assert.strictEqual(pick.tier, 'premium');
  assert.strictEqual(pick.escalate, true);
  assert.match(pick.escalation_reason, /no_free_candidate_meets_bar/);
});

test('AC6/AC4: diverse jury picks distinct families (correlated-panel fix)', () => {
  const jury = optimizer.selectDiversePanel(PANEL, 3);
  const fams = jury.map((c) => c.family);
  assert.strictEqual(new Set(fams).size, fams.length, 'no family repeats before all are used');
  assert.ok(jury.every((c) => c.judge_eligible !== false), 'weak models excluded from the jury');
});

test('AC6: empty panel returns null rather than throwing', () => {
  assert.strictEqual(optimizer.selectOptimal([], {}), null);
  assert.deepStrictEqual(optimizer.rankResources(null), []);
});

test('AC6: quality is an adequacy threshold, not a linear trade', () => {
  // A marginally-better paid model must never outrank an adequate free one.
  const pick = optimizer.selectOptimal(PANEL, { minQuality: 0.7 });
  assert.strictEqual(pick.tier, 'local');
});

// ---------- AC4: honest consensus-max stop ----------
test('AC4: correlated single-family panel refuses to proceed', () => {
  const r = honestStop.evaluateGate([{ family: 'llama' }, { family: 'llama' }, { family: 'llama' }], 93);
  assert.strictEqual(r.proceed, false);
  assert.match(r.stop_reason, /correlated_panel/);
  assert.match(r.report, /consensus-max=/);
});

test('AC4: unreachable gate stops honestly with consensus-max', () => {
  const r = honestStop.evaluateGate([{ family: 'qwen' }, { family: 'llama' }], 99);
  assert.strictEqual(r.proceed, false);
  assert.strictEqual(r.stop_reason, 'gate_unreachable_on_available_panel');
  assert.ok(r.consensus_max < 99);
});

test('AC4: reachable gate on a diverse panel proceeds', () => {
  const r = honestStop.evaluateGate([{ family: 'qwen' }, { family: 'deepseek' }, { family: 'llama' }], 93);
  assert.strictEqual(r.proceed, true);
  assert.ok(r.consensus_max >= 93);
});

test('AC4: empty panel is not usable', () => {
  assert.strictEqual(honestStop.evaluateGate([], 93).stop_reason, 'no_usable_panel');
});

test('AC4: iteration stops at the cap and on no improvement (bounded loop)', () => {
  const panel = [{ family: 'qwen' }, { family: 'deepseek' }, { family: 'llama' }];
  assert.strictEqual(honestStop.shouldIterate({ panel, gate: 90, iterations: 3 }, { maxIterations: 3 }).iterate, false);
  const stalled = honestStop.shouldIterate({ panel, gate: 90, iterations: 1, prevScore: 85, lastScore: 85 });
  assert.strictEqual(stalled.iterate, false);
  assert.strictEqual(stalled.reason, 'no_score_improvement');
});

// ---------- AC5: ROI telemetry ----------
test('AC5: ROI summary computes net position rather than asserting it', () => {
  const s = roi.summarize({ free_calls: 3, failed_dispatches: 2, paid_fallbacks: 0, wasted_ms: 40000 });
  assert.strictEqual(s.net_positive, true);
  assert.ok(s.cost_avoided_usd > 0);
  const bad = roi.summarize({ free_calls: 0, paid_fallbacks: 5 });
  assert.strictEqual(bad.net_positive, false, 'all-paid run is NOT net-positive');
});

test('AC5: event is schema-v3 shaped', () => {
  const e = roi.buildEvent({ free_calls: 1, ticket: 3803, families: ['qwen'] });
  assert.strictEqual(e.version, 3);
  assert.strictEqual(e.service, 'fleet-dispatch');
  assert.ok(e.ts && e.event && e._summary);
  assert.ok(e._summary.length <= 200);
});

test('AC5: recordRun appends to a JSONL file', () => {
  const file = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'roi-')), 'fleet-roi.jsonl');
  const r = roi.recordRun({ free_calls: 2, ticket: 3803 }, { file });
  assert.strictEqual(r.ok, true);
  const lines = fs.readFileSync(file, 'utf8').trim().split('\n');
  assert.strictEqual(lines.length, 1);
  assert.strictEqual(JSON.parse(lines[0]).version, 3);
});

test('AC5/G6: an unwritable telemetry path never throws', () => {
  // A file path whose PARENT is an existing regular file cannot be mkdir'd -> guaranteed
  // write failure without touching /proc (which hangs under the test sandbox).
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'roi-bad-'));
  const blocker = path.join(dir, 'blocker');
  fs.writeFileSync(blocker, 'not-a-directory');
  const r = roi.recordRun({ free_calls: 1 }, { file: path.join(blocker, 'nested', 'roi.jsonl') });
  assert.strictEqual(r.ok, false);
  assert.ok(r.event, 'event still returned to the caller');
});

// ---------- AC1: preflight ----------
test('AC1/G4: cloud preflight reports key PRESENCE only, never values', () => {
  const out = preflight.probeCloudRaters({ GROQ_API_KEY: 'sk-super-secret-value' });
  const groq = out.find((o) => o.provider === 'groq');
  assert.strictEqual(groq.key_present, true);
  assert.strictEqual(JSON.stringify(out).includes('sk-super-secret-value'), false, 'no key value leaks');
});

test('AC1: missing key is reported as no_key BEFORE a run', () => {
  const out = preflight.probeCloudRaters({});
  assert.ok(out.every((o) => o.key_present === false));
  assert.ok(out.every((o) => o.reason === 'no_key'));
});

test('AC1: preflight emits the usable panel and names unreachable hosts', async () => {
  const hosts = [
    { id: 'up', url: 'http://up', families: ['qwen'], max_concurrency: 1 },
    { id: 'down', url: 'http://down', families: ['deepseek'], max_concurrency: 1 },
  ];
  const fetchImpl = async (url) => {
    if (url.startsWith('http://up')) return { ok: true, json: async () => ({ models: [{ name: 'qwen2.5-coder:32b' }] }) };
    return { ok: false, status: 503 };
  };
  const r = await preflight.fleetPreflight({ hosts, fetchImpl, env: {} });
  assert.strictEqual(r.fleet_panel.length, 1);
  assert.strictEqual(r.fleet_panel[0].model, 'qwen2.5-coder:32b');
  assert.strictEqual(r.fleet_panel[0].timeout_ms > 0, true, 'panel carries capability profile');
  assert.deepStrictEqual(r.unreachable_hosts, [{ id: 'down', reason: 'http_503' }]);
  assert.ok(r.families.includes('qwen'));
});

test('AC1/G6: a throwing host probe is a status, not an exception', async () => {
  const fetchImpl = async () => { throw new Error('ECONNREFUSED'); };
  const r = await preflight.probeHost({ id: 'x', url: 'http://x', families: [] }, fetchImpl, 50);
  assert.strictEqual(r.reachable, false);
  assert.strictEqual(r.reason, 'unreachable');
});
