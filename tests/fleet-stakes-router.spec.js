'use strict';
// tdd-pyramid unit tests for the Fleet Advisor stakes router + keep-warm pool (Epic #3414 #3484).

const assert = require('node:assert/strict');
const { test } = require('node:test');
const router = require('../scripts/global/fleet-stakes-router.js');
const { warmPool } = require('../scripts/global/fleet-warm-pool.js');

test('AC2 — routine work routes to the resident 7B on the hot path', () => {
  const r = router.resolveFleetRoute('add a helper function to format dates');
  assert.equal(r.stakes, 'routine');
  assert.equal(r.model, router.DEFAULT_HOT_MODEL);
  assert.equal(r.hotPath, true);
  assert.equal(r.keepAlive, router.HOT_KEEP_ALIVE);
});

test('AC2 — high-stakes content markers route to the 32B with a short keep_alive', () => {
  for (const p of ['analyze this security vulnerability', 'design the system architecture', 'debug this race condition']) {
    const r = router.resolveFleetRoute(p);
    assert.equal(r.stakes, 'high', p);
    assert.equal(r.model, router.DEFAULT_HIGH_STAKES_MODEL);
    assert.equal(r.keepAlive, router.HIGH_STAKES_KEEP_ALIVE);
  }
});

test('AC2 — manager/consultant baton roles are high-stakes (reasoning-heavy)', () => {
  assert.equal(router.classifyStakes('x', { role: 'consultant' }), 'high');
  assert.equal(router.classifyStakes('x', { role: 'manager' }), 'high');
  assert.equal(router.classifyStakes('x', { role: 'collaborator' }), 'routine');
});

test('AC2 — explicit stakes override wins over markers (deterministic precedence)', () => {
  assert.equal(router.classifyStakes('security audit', { stakes: 'routine' }), 'routine');
  assert.equal(router.classifyStakes('rename a var', { stakes: 'high' }), 'high');
});

test('AC2 — routing is deterministic: same input → same decision', () => {
  const a = router.resolveFleetRoute('refactor the parser', { role: 'collaborator' });
  const b = router.resolveFleetRoute('refactor the parser', { role: 'collaborator' });
  assert.deepEqual(a, b);
});

test('composes with a custom roster (per_role_lane_preferences hot/high models)', () => {
  const r = router.resolveFleetRoute('typo', { hotModel: 'llama3.1:8b', highStakesModel: 'qwen3:32b' });
  assert.equal(r.model, 'llama3.1:8b');
});

test('AC1 — warmHotModels pins the hot model with keep_alive (non-blocking)', async () => {
  const calls = [];
  const out = await router.warmHotModels({}, async (model, o) => { calls.push({ model, o }); });
  assert.deepEqual(out.warmed, [router.DEFAULT_HOT_MODEL]);
  assert.equal(calls[0].o.keepAlive, router.HOT_KEEP_ALIVE);
  assert.equal(calls[0].o.warm, true);
});

test('AC1 — warm failure is reported, never thrown (fleet down)', async () => {
  const out = await router.warmHotModels({ warmModels: ['m1', 'm2'] }, async (m) => { if (m === 'm1') throw new Error('down'); });
  assert.deepEqual(out.warmed, ['m2']);
  assert.equal(out.failed[0].model, 'm1');
});

test('AC1 — warmPool sends a keep_alive ping to the hot model via injected chat', async () => {
  const pings = [];
  const out = await warmPool({}, { chat: async (prompt, o) => { pings.push(o); } });
  assert.equal(out.warmed.length, 1);
  assert.equal(pings[0].keepAlive, router.HOT_KEEP_ALIVE);
  assert.equal(pings[0].maxTokens, 1);
});

test('AC1 — no dispatch fn provided → warm is skipped, not crashed', async () => {
  const out = await router.warmHotModels({});
  assert.deepEqual(out.warmed, []);
  assert.ok(out.skipped.length >= 1);
});
