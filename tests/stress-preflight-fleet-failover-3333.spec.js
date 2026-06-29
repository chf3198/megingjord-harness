// Refs #3333 — stress/regression suite for the bounded fleet-failover gate.
// AC3: a dead/unreachable fleet host must fail over to the $0 free-cloud tier in
// bounded time and MUST NOT enter the long generation call (REQUEST_TIMEOUT_MS up to
// 1500s x retries — the multi-minute preflight hang from #3331).
// G6 chaos: fault-injected reachability probe (returns-not-ok AND throws).
// G7 p99: latency budget assertion across repeated dead-fleet dispatches.
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const {
  dispatchRedTeam, fleetReachable, hostPort, FLEET_PROBE_TIMEOUT_MS,
} = require('../scripts/global/fleet-red-team-dispatch.js');
const { partitionSpecs } = require('../scripts/global/collaborator-preflight.js');

function p99(samples) {
  const s = [...samples].sort((a, b) => a - b);
  return s[Math.floor(s.length * 0.99)] || s[s.length - 1];
}

// A wrap impl that fails the test if the long generation path is ever reached.
const wrapMustNotRun = async () => {
  throw new Error('REGRESSION: long generation call entered on an unreachable fleet host');
};

// Inject a model so the (network-hitting) resident probe is skipped — the gate logic
// under test is identical with or without a forced model, but this keeps the test
// hermetic (no real fetch to the fleet host).
function deadFleetDispatch(probeImpl, freeCloudImpl) {
  return dispatchRedTeam({
    artifactType: 'collaborator-handoff',
    content: 'COLLABORATOR_HANDOFF body under review',
    model: 'qwen2.5-coder:7b',
    deps: {
      dispatchGet: probeImpl,
      wrapProviderCall: wrapMustNotRun,
      freeCloud: { dispatchFreeCloud: freeCloudImpl },
    },
  });
}

test('AC3 G6: unreachable fleet (probe not-ok) fails over to free-cloud, skips long generate', async () => {
  const result = await deadFleetDispatch(
    async () => ({ ok: false, error: 'network_error' }),
    async () => ({ ok: true, content: 'PARTIAL rating: 80 — looks fine', provider: 'groq' }),
  );
  assert.equal(result.hamrStats.substituted, true, 'free-cloud failover should engage');
  assert.equal(result.hamrStats.tier, 'free-cloud');
  assert.match(result.modelUsed, /free-cloud:groq/);
});

test('AC3 G6 chaos: probe THROWS (DNS/abort fault) is treated as unreachable, no hang', async () => {
  const result = await deadFleetDispatch(
    async () => { throw new Error('getaddrinfo ENOTFOUND injected'); },
    async () => ({ ok: true, content: 'ACCEPT rating: 90', provider: 'cerebras' }),
  );
  assert.equal(result.hamrStats.substituted, true);
});

test('AC1/AC3: fleet AND free-cloud down -> visible degraded non-pass, never hangs', async () => {
  const result = await deadFleetDispatch(
    async () => ({ ok: false, error: 'timeout' }),
    async () => ({ ok: false, tried: ['groq:no_key'] }),
  );
  assert.equal(result.hamrStats.ok, false, 'degraded envelope, not a fabricated pass');
  assert.equal(result.hamrStats.degraded, true);
});

test('AC3 G7 p99: 30 dead-fleet dispatches stay well under a bounded latency budget', async () => {
  const samples = [];
  for (let i = 0; i < 30; i++) {
    const start = Date.now();
    await deadFleetDispatch(
      async () => ({ ok: false, error: 'network_error' }),
      async () => ({ ok: true, content: 'PARTIAL rating: 75', provider: 'groq' }),
    );
    samples.push(Date.now() - start);
  }
  // Mocked I/O resolves immediately; the gate must add no unbounded wait. Budget is
  // generous (1500ms) but orders of magnitude below the 90s AC1 ceiling and the
  // multi-minute hang the probe replaces.
  const budget = 1500;
  assert.ok(p99(samples) < budget, `p99 ${p99(samples)}ms exceeded ${budget}ms budget`);
});

test('fleetReachable: true only on a real ok probe; false on not-ok / throw', async () => {
  assert.equal(await fleetReachable('http://h:11434', { dispatchGet: async () => ({ ok: true }) }), true);
  assert.equal(await fleetReachable('http://h:11434', { dispatchGet: async () => ({ ok: false }) }), false);
  assert.equal(await fleetReachable('http://h:11434', { dispatchGet: async () => { throw new Error('x'); } }), false);
});

test('hostPort strips scheme + trailing slash for the host:port probe parser', () => {
  assert.equal(hostPort('http://100.91.113.16:11434'), '100.91.113.16:11434');
  assert.equal(hostPort('https://host:11434/'), 'host:11434');
  assert.equal(hostPort('100.91.113.16:11434'), '100.91.113.16:11434');
});

test('FLEET_PROBE_TIMEOUT_MS is a bounded, small positive default', () => {
  assert.ok(FLEET_PROBE_TIMEOUT_MS > 0 && FLEET_PROBE_TIMEOUT_MS <= 30000);
});

test('AC2: partitionSpecs routes @playwright/test specs away from node:test', () => {
  const reader = (p) => (p.includes('pw')
    ? "const { test } = require('@playwright/test');"
    : "const test = require('node:test');");
  const { node, playwright } = partitionSpecs(['a.spec.js', 'pw.spec.js', 'b.spec.js'], reader);
  assert.deepEqual(playwright, ['pw.spec.js']);
  assert.deepEqual(node, ['a.spec.js', 'b.spec.js']);
});

test('AC2: partitionSpecs treats an unreadable spec as node:test (fail-safe)', () => {
  const { node, playwright } = partitionSpecs(['missing.spec.js'], () => { throw new Error('ENOENT'); });
  assert.deepEqual(node, ['missing.spec.js']);
  assert.deepEqual(playwright, []);
});
