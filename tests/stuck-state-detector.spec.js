// tdd-pyramid unit suite for the unified stuck-state detector (#3748, R2 of #3059).
const test = require('node:test');
const assert = require('node:assert');
const D = require('../scripts/global/stuck-state-detector');

test('loop-fingerprint fires at threshold (reuses friction-sensors detectRetries)', () => {
  const inv = [{ tool: 'Bash', command: 'npm test' }, { tool: 'Bash', command: 'npm test' }, { tool: 'Bash', command: 'npm test' }];
  const r = D.detectStuckState({ invocations: inv });
  assert.equal(r.stuck, true);
  assert.ok(r.triggers.includes('loop-fingerprint'));
});

test('two near-identical invocations do NOT fire (below threshold)', () => {
  const inv = [{ tool: 'Bash', command: 'npm test' }, { tool: 'Bash', command: 'npm test' }];
  assert.equal(D.detectStuckState({ invocations: inv }).stuck, false);
});

test('iteration cap, token cap, tool-error burst, divergence, and explicit signals each fire', () => {
  assert.ok(D.detectStuckState({ iterationCount: 25 }).triggers.includes('iteration-cap'));
  assert.ok(D.detectStuckState({ tokenBudgetFraction: 1.0 }).triggers.includes('token-budget-cap'));
  assert.ok(D.detectStuckState({ toolErrorCount: 3 }).triggers.includes('tool-error-burst'));
  assert.ok(D.detectStuckState({ sampledResolutions: ['A', 'B', 'C'] }).triggers.includes('self-consistency-divergence'));
  for (const sig of ['stuck-pr', 'ambiguous-gate', 'novel-failure']) {
    assert.ok(D.detectStuckState({ explicit: sig }).triggers.includes(sig));
  }
});

test('confidence is IGNORED — high confidence with no trigger is not stuck (axis is reversibility/blast-radius)', () => {
  assert.equal(D.detectStuckState({ confidence: 0.99, iterationCount: 2 }).stuck, false);
});

test('hysteresis: once active, stays active until value drops below the clear threshold', () => {
  // 22 is below the fire cap (25) but above the clear (20): fires only when prior-active.
  assert.equal(D.detectStuckState({ iterationCount: 22 }).stuck, false);
  assert.equal(D.detectStuckState({ iterationCount: 22 }, { prior: { iteration: true } }).stuck, true);
  assert.equal(D.detectStuckState({ iterationCount: 20 }, { prior: { iteration: true } }).stuck, false);
});

test('divergenceRatio: <2 samples is 0; full consensus is 0; split is >0', () => {
  assert.equal(D.divergenceRatio(['A']), 0);
  assert.equal(D.divergenceRatio(['A', 'A', 'A']), 0);
  assert.ok(D.divergenceRatio(['A', 'B']) > 0);
});

test('gateToFlags maps irreversible / high-destructive blast to the human carve-out flag', () => {
  assert.equal(D.gateToFlags({ reversibility: 'irreversible' }).irreversible, true);
  assert.equal(D.gateToFlags({ blastRadius: 'high-destructive' }).irreversible, true);
  assert.equal(D.gateToFlags({ reversibility: 'reversible', blastRadius: 'low' }).irreversible, false);
});

test('routeStuckState: not-stuck returns detected:false and does NOT call decide()', async () => {
  let called = false;
  const out = await D.routeStuckState({ iterationCount: 1 }, { decide: async () => { called = true; return {}; } });
  assert.equal(out.detected, false);
  assert.equal(called, false);
});

test('routeStuckState: stuck+reversible auto-adjudicates (advisory), never a client prompt', async () => {
  const fakeDecide = async (decision) => ({ route: 'adjudicate', chosen: 1, flags: decision.flags });
  const out = await D.routeStuckState({ explicit: 'ambiguous-gate', reversibility: 'reversible' }, { decide: fakeDecide, options: ['A', 'B'] });
  assert.equal(out.detected, true);
  assert.equal(out.advisory, true);
  assert.equal(out.decision.route, 'adjudicate');
  assert.equal(out.decision.flags.irreversible, false);
});

test('routeStuckState: stuck+irreversible routes decide() toward the human carve-out flag', async () => {
  const fakeDecide = async (decision) => ({ route: 'human-carveout', flags: decision.flags });
  const out = await D.routeStuckState({ explicit: 'novel-failure', reversibility: 'irreversible' }, { decide: fakeDecide });
  assert.equal(out.decision.flags.irreversible, true);
});

test('routeStuckState propagates the detection error flag (G8 observability) when not stuck', async () => {
  // A malformed signal that trips detectStuckState's catch → error:true, stuck:false.
  const out = await D.routeStuckState({ get invocations() { throw new Error('boom'); } }, { decide: async () => ({}) });
  assert.equal(out.detected, false);
  assert.equal(out.error, true);
});

test('routeStuckState is fail-safe when decide() throws — degrades to self-resolve, never a client prompt', async () => {
  const boom = async () => { throw new Error('panel exploded'); };
  const out = await D.routeStuckState({ explicit: 'stuck-pr' }, { decide: boom });
  assert.equal(out.detected, true);
  assert.equal(out.decision.route, 'self-resolve');
  assert.equal(out.decision.degraded, true);
  assert.notEqual(out.decision.route, 'human-carveout');
});

test('divergence trigger now has hysteresis (clears at the lower floor)', () => {
  // ratio 0.4 (2 of 5 disagree → 0.4) is below fire 0.5 but above clear 0.34: fires only when prior-active.
  const s = { sampledResolutions: ['A', 'A', 'A', 'B', 'C'] };
  assert.equal(D.detectStuckState(s).triggers.includes('self-consistency-divergence'), false);
  assert.equal(D.detectStuckState(s, { prior: { divergence: true } }).triggers.includes('self-consistency-divergence'), true);
});
