// tdd-pyramid unit suite for the client-prompt-rate observability module (#3405, Epic #3392 AC4).
const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const M = require('../scripts/global/client-prompt-rate');

const TS = '2026-06-30T00:00:00.000Z';
function tmpSurface() {
  return path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'cpr-')), 'events.jsonl');
}
function readBack(file) {
  return fs.readFileSync(file, 'utf8').split('\n').filter(Boolean).map((l) => JSON.parse(l));
}

test('recordDecision writes a schema-v3 decision event', () => {
  const file = tmpSurface();
  assert.equal(M.recordDecision({ route: 'self-resolve', tier: 'trivial' }, { file, ts: TS }), true);
  const [ev] = readBack(file);
  assert.equal(ev.event, 'governance.client-prompt-decision');
  assert.equal(ev.version, 3);
  assert.equal(ev.reached_human, false);
  assert.equal(ev.non_carve_out_prompt, false);
});

test('a human-carveout decision is a prompt but NOT a non-carve-out prompt', () => {
  const file = tmpSurface();
  M.recordDecision({ route: 'human-carveout', tier: 'security-weakening' }, { file, ts: TS });
  const [ev] = readBack(file);
  assert.equal(ev.reached_human, true);
  assert.equal(ev.carve_out, 'human-carveout');
  assert.equal(ev.non_carve_out_prompt, false); // carve-outs are sanctioned → excluded
});

test('computeClientPromptRate excludes the carve-out class', () => {
  const events = [
    { event: 'governance.client-prompt-decision', reached_human: true, non_carve_out_prompt: true, carve_out: null },
    { event: 'governance.client-prompt-decision', reached_human: true, non_carve_out_prompt: false, carve_out: 'human-carveout' },
    { event: 'governance.client-prompt-decision', reached_human: false, non_carve_out_prompt: false },
    { event: 'governance.client-prompt-decision', reached_human: false, non_carve_out_prompt: false },
  ];
  const r = M.computeClientPromptRate(events);
  assert.equal(r.total, 4);
  assert.equal(r.nonCarveOutPrompts, 1);
  assert.equal(r.carveOutPrompts, 1);
  assert.equal(r.rate, 0.25);
});

test('an all-carve-out / all-self-resolve set has non-carve-out rate trending to 0', () => {
  const events = [
    { event: 'governance.client-prompt-decision', reached_human: true, non_carve_out_prompt: false, carve_out: 'design-direction' },
    { event: 'governance.client-prompt-decision', reached_human: false, non_carve_out_prompt: false },
  ];
  assert.equal(M.computeClientPromptRate(events).rate, 0);
});

test('computeClientPromptRate of an empty set is 0 (no divide-by-zero)', () => {
  assert.equal(M.computeClientPromptRate([]).rate, 0);
});

test('logAdjudication writes the G8 decision-log fields', () => {
  const file = tmpSurface();
  M.logAdjudication({ path: 'which lock?', risk_tier: 'options', panel_scores: { A: 90 }, confidence: 88, rollback_handle: 'h1' }, { file, ts: TS });
  const [ev] = readBack(file);
  assert.equal(ev.event, 'governance.adjudication-decision');
  assert.equal(ev.decision_path, 'which lock?');
  assert.equal(ev.confidence, 88);
  assert.equal(ev.rollback_handle, 'h1');
});

test('reversibilityAudit returns a handle when reversible, flags when not', () => {
  const file = tmpSurface();
  const ok = M.reversibilityAudit({ path: 'p', rollback_handle: 'rb-1' }, { file, ts: TS });
  assert.equal(ok.reversible, true);
  assert.equal(ok.rollback_handle, 'rb-1');
  const bad = M.reversibilityAudit({ path: 'p2' }, { file, ts: TS });
  assert.equal(bad.reversible, false);
  const evs = readBack(file);
  assert.equal(evs[1].reversible, false);
});

test('makeGuardrailLogger feeds guardrail decisions into the rate + adjudication log', () => {
  const file = tmpSurface();
  const logger = M.makeGuardrailLogger({ file, ts: TS });
  logger({ route: 'adjudicate', tier: 'options', question: 'q', score: 91, perOption: [{ option: 1 }] });
  logger({ route: 'human-carveout', tier: 'security-weakening', question: 'weaken guard?' });
  logger({ route: 'self-resolve', tier: 'trivial' });
  const evs = readBack(file);
  const decisions = evs.filter((e) => e.event === 'governance.client-prompt-decision');
  const adjudications = evs.filter((e) => e.event === 'governance.adjudication-decision');
  assert.equal(decisions.length, 3);
  assert.equal(adjudications.length, 1);
  // the security-weakening carve-out is recorded as a carve-out, not a non-carve-out prompt
  const r = M.computeClientPromptRate(decisions);
  assert.equal(r.nonCarveOutPrompts, 0);
});

test('all writers are fail-open: an unwritable surface never throws', () => {
  // Use a regular file as a parent dir → ENOTDIR fails fast (no /proc, which can hang the runner).
  const blocker = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'cpr-bad-')), 'blocker');
  fs.writeFileSync(blocker, 'x');
  const bad = path.join(blocker, 'events.jsonl');
  assert.equal(M.recordDecision({ route: 'self-resolve' }, { file: bad, ts: TS }), false);
  assert.doesNotThrow(() => M.logAdjudication({ path: 'x' }, { file: bad, ts: TS }));
  assert.doesNotThrow(() => M.reversibilityAudit({ path: 'x' }, { file: bad, ts: TS }));
});
