// Tests for the plan-rating promotion gate (Epic #3822 C2, Gap B, #3826).
// Structural (un-forgeable receipt) -> semantic (>=90 numeric + validity floor),
// the predicate conjunct in phase0GreenComplete, and the closure-guard block.
const { test, expect } = require('@playwright/test');
const gate = require('../scripts/global/megalint/phase0-promotion-gate');
const resolver = require('../scripts/global/phase0-promotion-resolver');
const guard = require('../scripts/global/phase0-closure-guard');
const rc = require('../scripts/global/cross-family-receipt');
const { validPlanRating, buildLedger } = require('./phase0-github-mock');

const EPIC = 7001;
const comment = (receipt, o = {}) => ({
  body: `## PLAN_RATING\nplan_rating_receipt: ${receipt}\nplan_rating_median: ${o.median ?? 93}\n`
    + `plan_rating_distinct_families: ${o.families ?? 3}\nplan_rating_gwet_ac1: ${o.gwet ?? 0.71}`,
});

// ---- parsePlanRating ----
test('parsePlanRating reads the first receipt-bearing block; null when none', () => {
  expect(resolver.parsePlanRating([{ body: 'no receipt here' }])).toBe(null);
  const p = resolver.parsePlanRating([comment('abcdef0123456789', { median: 91, families: 4, gwet: 0.7 })]);
  expect(p).toEqual({ receipt: 'abcdef0123456789', median: 91, families: 4, gwet: 0.7 });
});

// ---- hasVerifiedPlanRatingReceipt: structural ----
test('STRUCTURAL: no receipt in comments blocks (the #3808 class)', () => {
  const r = resolver.hasVerifiedPlanRatingReceipt(EPIC, [{ body: '## EPIC_RESCOPE done' }]);
  expect(r.ok).toBe(false);
  expect(r.reason).toBe('no-plan-rating-receipt');
});

test('STRUCTURAL: a forged receipt not matching the ledger blocks', () => {
  const pr = validPlanRating(EPIC);
  const r = resolver.hasVerifiedPlanRatingReceipt(EPIC, [comment('0000000000000000')], { ledger: pr.ledger });
  expect(r.ok).toBe(false);
  expect(r.reason).toContain('receipt-');
});

test('STRUCTURAL: a single-family panel blocks (popularity-trap guard)', () => {
  const base = { ticket: EPIC, kind: 'review', verdict: 'PASS', ts: 't', prompt_sha256: rc.sha('p') };
  const ledger = buildLedger([
    { ...base, provider: 'groq', family: 'meta', response_sha256: rc.sha('a') },
    { ...base, provider: 'cerebras', family: 'meta', response_sha256: rc.sha('b') }, // same family
  ]);
  const receipt = rc.computeReceipt(ledger);
  const r = resolver.hasVerifiedPlanRatingReceipt(EPIC, [comment(receipt)], { ledger });
  expect(r.ok).toBe(false);
  expect(r.reason).toContain('insufficient-family-diversity');
});

test('STRUCTURAL: a tampered chain blocks', () => {
  const pr = validPlanRating(EPIC);
  const tampered = pr.ledger.map((e, i) => (i === 0 ? { ...e, verdict: 'REJECT' } : e)); // break the chain
  const r = resolver.hasVerifiedPlanRatingReceipt(EPIC, [comment(pr.receipt)], { ledger: tampered });
  expect(r.ok).toBe(false);
  expect(r.reason).toContain('ledger-tampered');
});

// ---- hasVerifiedPlanRatingReceipt: semantic ----
test('SEMANTIC: a structurally-valid receipt with median < 90 blocks', () => {
  const pr = validPlanRating(EPIC, { median: 87 });
  const r = resolver.hasVerifiedPlanRatingReceipt(EPIC, [pr.comment], { ledger: pr.ledger });
  expect(r.ok).toBe(false);
  expect(r.reason).toContain('median-below-90');
});

test('SEMANTIC: distinct_families < 3 blocks even with a valid receipt', () => {
  const pr = validPlanRating(EPIC, { families: 2 });
  const r = resolver.hasVerifiedPlanRatingReceipt(EPIC, [pr.comment], { ledger: pr.ledger });
  expect(r.ok).toBe(false);
  expect(r.reason).toContain('distinct-families-below-3');
});

test('SEMANTIC: gwet_ac1 below the D4 floor blocks', () => {
  const pr = validPlanRating(EPIC, { gwet: 0.4 });
  const r = resolver.hasVerifiedPlanRatingReceipt(EPIC, [pr.comment], { ledger: pr.ledger });
  expect(r.ok).toBe(false);
  expect(r.reason).toContain('gwet-ac1-below-floor');
});

test('a fully valid plan-rating (>=90, >=3 families, gwet>=0.6, real receipt) passes', () => {
  const pr = validPlanRating(EPIC, { median: 93, families: 3, gwet: 0.71 });
  const r = resolver.hasVerifiedPlanRatingReceipt(EPIC, [pr.comment], { ledger: pr.ledger });
  expect(r.ok).toBe(true);
  expect(r.median).toBe(93);
});

// ---- predicate conjunct ----
const epicInput = (planRating) => ({
  labels: ['type:epic', 'phase-gate:research-first'],
  comments: [{ body: '## EPIC_RESCOPE done' }],
  children: [{ number: 2, state: 'closed', labels: ['phase-gate:research-first'], comments: [{ body: 'CONSULTANT_CLOSEOUT' }] },
    { number: 3, state: 'open', labels: ['phase-gate:phase-1'], comments: [] }],
  planRating,
});

test('CONJUNCT: an un-rated plan is not complete and flags unratedPlan (fail-closed default)', () => {
  const r = gate.phase0GreenComplete({ ...epicInput(undefined), planRating: undefined });
  expect(r.complete).toBe(false);
  expect(r.unratedPlan).toBe(true);
  expect(r.phase0SubstantiallyDone).toBe(true);
  expect(r.details).toContain('un-rated');
});

test('CONJUNCT: a verified plan-rating makes an otherwise-green Phase-0 complete', () => {
  const r = gate.phase0GreenComplete(epicInput({ ok: true, reason: 'plan-rating-verified' }));
  expect(r.complete).toBe(true);
  expect(r.unratedPlan).toBe(false);
});

// ---- closure-guard wire-in ----
test('CLOSE-GATE: evaluateClosure blocks an un-rated substantially-done Phase-0', () => {
  const r = gate.phase0GreenComplete({ ...epicInput(undefined), planRating: { ok: false, reason: 'no-plan-rating-receipt' } });
  const e = guard.evaluateClosure(r);
  expect(e.block).toBe(true);
  expect(e.unrated).toBe(true);
});

test('CLOSE-GATE: buildBlockerNote names the plan-rating remedy on the un-rated path', () => {
  const r = gate.phase0GreenComplete({ ...epicInput(undefined), planRating: { ok: false, reason: 'no-plan-rating-receipt' } });
  const note = guard.buildBlockerNote(7001, r);
  expect(note).toContain('no verified cross-family rating receipt');
  expect(note).toContain('plan_rating_receipt');
  expect(note).toContain('PHASE0_GATE_BYPASS=1'); // audited escape hatch stays visible
});
