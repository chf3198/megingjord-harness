'use strict';
// Tests for Epic #3425 P1-f (#3433): the none-vs-candidate reconciler (anti-checkbox-fatigue).
// Strategy: tdd-pyramid + stress. node:test + node:assert.

const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const rec = require('../scripts/global/none-vs-candidate-reconciler.js');
const fr = require('../scripts/global/megalint/flaws-recognized.js');

const NONE_BODY = '## MANAGER_HANDOFF\nscope: x\nflaws_recognized: none\nSigned-by: y';
function tmpIncidents(patternId, count) {
  const file = path.join(os.tmpdir(), `rec-inc-${process.pid}-${count}.jsonl`);
  const rows = [];
  for (let i = 0; i < count; i++) rows.push(JSON.stringify({ event: 'governance.friction', tier: 1, pattern_id: patternId, severity: 'low', ts: '2026-06-30T12:00:00Z' }));
  fs.writeFileSync(file, rows.join('\n') + (count ? '\n' : ''));
  return file;
}

// ---- AC2 state machine ----
test('none + zero candidates -> pass', () => {
  assert.equal(rec.reconcile({ body: NONE_BODY, candidates: [] }).status, 'pass');
});

test('none + only un-escalated low-sev -> advisory', () => {
  const out = rec.reconcile({ body: NONE_BODY, candidates: [{ pattern_id: 'friction-retry-loop', severity: 'low' }], incidentsPath: '/no/file' });
  assert.equal(out.status, 'advisory');
  assert.equal(out.advisory.length, 1);
});

test('none + a high candidate -> violation', () => {
  const out = rec.reconcile({ body: NONE_BODY, candidates: [{ pattern_id: 'hamr-bypass', severity: 'high' }] });
  assert.equal(out.status, 'violation');
  assert.equal(out.blocking.length, 1);
});

test('none + a medium candidate -> violation', () => {
  assert.equal(rec.reconcile({ body: NONE_BODY, candidates: [{ pattern_id: 'gate-fail', severity: 'medium' }] }).status, 'violation');
});

// ---- AC3 recurrence escalation ----
test('AC3: 3rd same-pattern low-sev escalates to medium -> none becomes a violation', () => {
  const file = tmpIncidents('friction-retry-loop', 2); // +1 this occurrence == 3 -> escalate
  const out = rec.reconcile({ body: NONE_BODY, candidates: [{ pattern_id: 'friction-retry-loop', severity: 'low' }], incidentsPath: file });
  assert.equal(out.status, 'violation');
  fs.unlinkSync(file);
});

test('AC3 boundary: below the 3-strike threshold stays advisory', () => {
  const file = tmpIncidents('friction-retry-loop', 1); // +1 == 2 -> not escalated
  assert.equal(rec.reconcile({ body: NONE_BODY, candidates: [{ pattern_id: 'friction-retry-loop', severity: 'low' }], incidentsPath: file }).status, 'advisory');
  fs.unlinkSync(file);
});

// ---- AC4 medium-confidence F6 never blocks ----
test('AC4: a medium-confidence F6 contradiction never forces a violation (advisory forever)', () => {
  const out = rec.reconcile({ body: NONE_BODY, candidates: [{ class: 'F6', pattern_id: 'asserted-vs-observed', severity: 'high', confidence: 'medium' }] });
  assert.equal(out.status, 'advisory');
  assert.equal(rec.candidateBlocksNone({ class: 'F6', confidence: 'medium', severity: 'high' }), false);
});

test('a HIGH-confidence F6 contradiction DOES block a none', () => {
  assert.equal(rec.candidateBlocksNone({ class: 'F6', confidence: 'high', severity: 'high' }), true);
});

// ---- disposed block is out of scope (P1-a owns it) ----
test('a disposed (non-none) block is pass regardless of candidates', () => {
  const disposed = 'flaws_recognized:\n  - flaw: x\n    decision: file-ticket\n    artifact: #1\n';
  assert.equal(rec.reconcile({ body: disposed, candidates: [{ severity: 'high', pattern_id: 'p' }] }).status, 'pass');
});

// ---- AC1/AC5 validator wiring: findings are advisory ----
test('AC5: validator wiring surfaces the violation as ADVISORY (never blocks in this ship)', () => {
  const r = fr.validate({ comments: [{ body: NONE_BODY }],
    candidatesBySurface: { 'review-point:manager': [{ pattern_id: 'hamr-bypass', severity: 'high' }] } });
  assert.equal(r.ok, true, 'advisory ship: ok stays true');
  assert.ok(r.violations.some((v) => v.rule === 'none-vs-candidate-violation' && v.severity === 'advisory'));
});

test('validator stays lenient (no reconciler finding) when no candidate feed is supplied', () => {
  const r = fr.validate({ comments: [{ body: NONE_BODY }] });
  assert.ok(!r.violations.some((v) => v.rule && v.rule.startsWith('none-vs-candidate')));
});
