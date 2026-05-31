const test = require('node:test');
const assert = require('node:assert');
const {
  routeForTask, candidatesFromInventory, scoreCandidate, tierForDevice,
  TIER_LOCAL, TIER_FLEET,
} = require('../scripts/global/fleet-router');

const FIXTURE_DEVICES = {
  devices: [
    { id: 'penguin-1', tailscale: true, ollama: true, tailscaleIP: '100.86.248.35',
      ollamaModels: ['tinyllama:latest'], routing: { priority: 10 } },
    { id: '36gbwinresource', tailscale: true, ollama: true, tailscaleIP: '100.91.113.16',
      ollamaModels: ['qwen2.5-coder:32b', 'qwen2.5-coder:7b'], routing: { priority: 100 } },
  ],
};

const FIXTURE_PROFILE = {
  hosts: {
    'penguin-1': { models: { 'tinyllama:latest': { total_p99_s: 20, timeout_recommendation_s: 40 } } },
    '36gbwinresource': {
      models: {
        'qwen2.5-coder:32b': { total_p99_s: 1500, timeout_recommendation_s: 3000 },
        'qwen2.5-coder:7b': { total_p99_s: 120, timeout_recommendation_s: 240 },
      },
    },
  },
};

function mockFs(devices, profile) {
  return {
    readFileSync(path) {
      if (path.includes('devices.json')) return JSON.stringify(devices);
      if (path.includes('fleet-latency-profile.json')) return JSON.stringify(profile);
      throw new Error('unexpected path');
    },
  };
}

test('tierForDevice: tailscale+ollama => FLEET', () => {
  assert.strictEqual(tierForDevice({ tailscale: true, ollama: true, ollamaModels: ['m'] }), TIER_FLEET);
});

test('candidatesFromInventory: lists all models across hosts', () => {
  const out = candidatesFromInventory({
    devices: FIXTURE_DEVICES.devices, profile: FIXTURE_PROFILE.hosts,
  });
  assert.strictEqual(out.length, 3); // 1 tinyllama + 2 qwen
});

test('candidatesFromInventory: filters by max_tier', () => {
  const out = candidatesFromInventory({
    devices: FIXTURE_DEVICES.devices, profile: FIXTURE_PROFILE.hosts,
    max_tier: -1, // even tier 0 excluded
  });
  assert.strictEqual(out.length, 0);
});

test('scoreCandidate: lower score = better', () => {
  const a = { tier: 1, total_p99_s: 60, host_id: 'h', model: 'm' };
  const b = { tier: 5, total_p99_s: 60, host_id: 'h', model: 'm' };
  assert.ok(scoreCandidate(a) < scoreCandidate(b));
});

test('scoreCandidate: high load penalizes', () => {
  const c = { tier: 1, total_p99_s: 60, host_id: 'h', model: 'm' };
  assert.ok(scoreCandidate(c, { 'h:m': 5 }) > scoreCandidate(c, { 'h:m': 0 }));
});

test('routeForTask: picks fastest fleet candidate first', async () => {
  const result = await routeForTask('any', {
    fs: mockFs(FIXTURE_DEVICES, FIXTURE_PROFILE),
  });
  assert.strictEqual(result.model, 'tinyllama:latest'); // total_p99 = 20 wins
});

test('routeForTask: returns 2 fallbacks', async () => {
  const result = await routeForTask('any', {
    fs: mockFs(FIXTURE_DEVICES, FIXTURE_PROFILE),
  });
  assert.strictEqual(result.fallback_chain.length, 2);
});

test('routeForTask: returns null when no candidates', async () => {
  const empty = { devices: [] };
  const result = await routeForTask('any', { fs: mockFs(empty, FIXTURE_PROFILE) });
  assert.strictEqual(result, null);
});

test('routeForTask: respects current_load_map', async () => {
  const result = await routeForTask('any', {
    fs: mockFs(FIXTURE_DEVICES, FIXTURE_PROFILE),
    current_load_map: { 'penguin-1:tinyllama:latest': 10 },
  });
  // High load on tinyllama → qwen7b should win instead
  assert.notStrictEqual(result.model, 'tinyllama:latest');
});
