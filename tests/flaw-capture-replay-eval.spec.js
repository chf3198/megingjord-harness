'use strict';
// Eval-harness tests for Epic #3425 P1-g (#3434): the advisory->blocking promotion gate.
// Strategy: eval-harness — corpus fixtures under tests/eval/**; precision/floor/promotion/auto-revoke
// assertions incl. the shipped seed staying advisory. node:test + node:assert.

const test = require('node:test');
const assert = require('node:assert');
const path = require('node:path');

const evalGate = require('../scripts/global/flaw-capture-replay-eval.js');
const { build } = require('../scripts/global/flaw-capture-corpus-build.js');

// Build a synthetic corpus that MEETS every floor, with a tunable precision per class.
function fullCorpus({ precision = 1.0, classes = evalGate.FRICTION_CLASSES } = {}) {
  const roles = ['manager', 'collaborator', 'admin', 'consultant'];
  const out = [];
  for (const cls of classes) {
    for (let i = 0; i < 30; i++) { // >= MIN_PER_CLASS and enough for >= MIN_PER_ROLE across 4 roles
      const surfaced = true;
      const isReal = i / 30 < precision; // first `precision` fraction are real
      const entry = { id: `${cls}-${i}`, friction_class: cls, role: roles[i % 4],
        surfaced, is_real_flaw: isReal, label_source: 'auto' };
      if (cls === 'F6') entry.confidence = 'high';
      out.push(entry);
    }
  }
  return out; // 8 classes x 30 = 240 total, 30/class, 60/role
}

test('precision math: precision = surfaced-and-real / all-surfaced, per class + aggregate', () => {
  const corpus = [
    { friction_class: 'F1', role: 'admin', surfaced: true, is_real_flaw: true },
    { friction_class: 'F1', role: 'admin', surfaced: true, is_real_flaw: false },
    { friction_class: 'F1', role: 'admin', surfaced: false, is_real_flaw: false }, // not surfaced -> ignored
  ];
  const r = evalGate.scoreCorpus(corpus);
  assert.equal(r.perClass.F1.precision, 0.5);
  assert.equal(r.aggregatePrecision, 0.5);
});

test('AC2/AC3: a full high-precision corpus is promotion-eligible', () => {
  const r = evalGate.scoreCorpus(fullCorpus({ precision: 1.0 }));
  assert.equal(evalGate.sampleFloorsMet(r), true);
  assert.equal(evalGate.promotionEligible(r), true);
});

test('AC3: below-floor sample is NOT promotion-eligible even at perfect precision', () => {
  const r = evalGate.scoreCorpus(fullCorpus({ precision: 1.0, classes: ['F1', 'F2'] })); // only 60 total
  assert.equal(evalGate.sampleFloorsMet(r), false);
  assert.equal(evalGate.promotionEligible(r), false);
});

test('AC3: one class below 0.70 blocks whole-system promotion (no class rides the others)', () => {
  const corpus = fullCorpus({ precision: 1.0 });
  // poison F3: make all its surfaced samples false positives (precision 0)
  for (const e of corpus) if (e.friction_class === 'F3') e.is_real_flaw = false;
  const r = evalGate.scoreCorpus(corpus);
  assert.ok(r.perClass.F3.precision < 0.70);
  assert.equal(evalGate.promotionEligible(r), false);
  assert.ok(!evalGate.promotedClasses(r).includes('F3'));
  assert.ok(evalGate.promotedClasses(r).includes('F1')); // per-class: the healthy classes still promote
});

test('AC4: auto-revoke — recomputing on a regressed corpus reverts promotion to advisory', () => {
  const good = evalGate.scoreCorpus(fullCorpus({ precision: 1.0 }));
  assert.equal(evalGate.promotionEligible(good), true);
  const regressed = evalGate.scoreCorpus(fullCorpus({ precision: 0.5 })); // aggregate drops below 0.85
  assert.equal(evalGate.promotionEligible(regressed), false);
  assert.equal(evalGate.blockingSeverityForClass('F1', regressed), 'advisory');
});

test('AC5: a medium-confidence F6 entry is excluded from precision (only high-confidence F6 blocks)', () => {
  const corpus = [
    { friction_class: 'F6', role: 'consultant', surfaced: true, is_real_flaw: false, confidence: 'medium' },
    { friction_class: 'F6', role: 'consultant', surfaced: true, is_real_flaw: true, confidence: 'high' },
  ];
  const r = evalGate.scoreCorpus(corpus);
  assert.equal(r.perClass.F6.precision, 1); // the medium FP is excluded, only the high TP counts
  assert.equal(evalGate.blockingEligible({ friction_class: 'F6', confidence: 'medium' }), false);
  assert.equal(evalGate.blockingEligible({ friction_class: 'F6', confidence: 'high' }), true);
});

test('AC6: FLAW_CAPTURE_DISABLED=1 forces not-eligible + no promoted classes (rollback no-op)', () => {
  const r = evalGate.scoreCorpus(fullCorpus({ precision: 1.0 }));
  const saved = process.env.FLAW_CAPTURE_DISABLED;
  process.env.FLAW_CAPTURE_DISABLED = '1';
  assert.equal(evalGate.promotionEligible(r), false);
  assert.deepEqual(evalGate.promotedClasses(r), []);
  if (saved === undefined) delete process.env.FLAW_CAPTURE_DISABLED; else process.env.FLAW_CAPTURE_DISABLED = saved;
});

test('shipped seed corpus stays ADVISORY (below the >=200 floor by design) and seeds the #3424 F6 positives', () => {
  const seed = build();
  const r = evalGate.scoreCorpus(seed);
  assert.equal(evalGate.promotionEligible(r), false, 'seed must not promote');
  assert.ok(seed.some((e) => /worktree-residual/.test(e.id) && e.friction_class === 'F6' && e.is_real_flaw));
  assert.ok(seed.some((e) => /squash-equivalence/.test(e.id) && e.friction_class === 'F6' && e.is_real_flaw));
});

test('the committed fixture loads and is scoreable', () => {
  const corpus = evalGate.loadCorpus(path.join(__dirname, 'eval', 'flaw-capture-corpus.json'));
  const r = evalGate.scoreCorpus(corpus);
  assert.ok(r.n > 0);
  const audit = evalGate.auditRecord(r, { ts: '2026-07-01T00:00:00Z' });
  assert.equal(audit.schema, 'flaw-capture-replay-eval-v1');
  assert.equal(audit.promotion_eligible, false);
});
