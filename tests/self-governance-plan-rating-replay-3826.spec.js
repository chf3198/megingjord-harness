// Replay proof for Gap B (Epic #3822 C2, #3826): every B-* case in the labeled
// self-governance decision corpus is driven through the REAL shipped path
// (hasVerifiedPlanRatingReceipt -> phase0GreenComplete -> evaluateClosure).
// Proves #3808 is caught, forged/single-family/below-90 are blocked, and a valid
// >=90 receipt promotes SILENTLY (no over-block — confirmation fatigue is a bug).
const { test, expect } = require('@playwright/test');
const fs = require('fs');
const path = require('path');
const gate = require('../scripts/global/megalint/phase0-promotion-gate');
const resolver = require('../scripts/global/phase0-promotion-resolver');
const guard = require('../scripts/global/phase0-closure-guard');
const rc = require('../scripts/global/cross-family-receipt');
const { validPlanRating, buildLedger } = require('./phase0-github-mock');

const CORPUS = JSON.parse(fs.readFileSync(
  path.join(__dirname, 'fixtures', 'self-governance-decision-corpus.json'), 'utf8'));
const B_CASES = CORPUS.cases.filter((c) => c.gap === 'B');
const EPIC = 8001;

// Translate a corpus B-case's abstract input into the concrete committed state
// (comments + ledger) the real interceptor consumes.
function materialize(input) {
  if (!input.plan_rating_receipt) return { comments: [{ body: '## EPIC_RESCOPE only' }], ledger: [] };
  const opts = { median: input.median_score ?? 93, families: input.distinct_families ?? 3, gwet: input.gwet_ac1 ?? 0.71 };
  if (input.verify_receipt === 'insufficient-family-diversity') {
    // popularity trap: a real chain, but only ONE distinct family.
    const base = { ticket: EPIC, kind: 'review', verdict: 'PASS', ts: 't', prompt_sha256: rc.sha('p') };
    const ledger = buildLedger([
      { ...base, provider: 'groq', family: 'meta', response_sha256: rc.sha('a') },
      { ...base, provider: 'cerebras', family: 'meta', response_sha256: rc.sha('b') },
    ]);
    return { comments: [{ body: `## PLAN_RATING\nplan_rating_receipt: ${rc.computeReceipt(ledger)}\nplan_rating_median: ${opts.median}\nplan_rating_distinct_families: 1\nplan_rating_gwet_ac1: ${opts.gwet}` }], ledger };
  }
  const pr = validPlanRating(EPIC, opts);
  if (input.verify_receipt === 'receipt-mismatch') {
    // forged: a receipt id not backed by the committed chain.
    return { comments: [{ body: pr.comment.body.replace(pr.receipt, '0000000000000000') }], ledger: pr.ledger };
  }
  return { comments: [pr.comment], ledger: pr.ledger };
}

function runCase(c) {
  const { comments, ledger } = materialize(c.input);
  const planRating = resolver.hasVerifiedPlanRatingReceipt(EPIC, comments, { ledger });
  const result = gate.phase0GreenComplete({
    labels: ['type:epic', 'phase-gate:research-first'],
    comments: [{ body: '## EPIC_RESCOPE' }, ...comments],
    children: [{ number: 2, state: 'closed', labels: ['phase-gate:research-first'], comments: [{ body: 'CONSULTANT_CLOSEOUT' }] },
      { number: 3, state: 'open', labels: ['phase-gate:phase-1'], comments: [] }],
    planRating,
  });
  return { planRating, result, close: guard.evaluateClosure(result) };
}

for (const c of B_CASES) {
  test(`replay ${c.id} (${c.label}) -> ${c.expected_route}`, () => {
    const { planRating, result, close } = runCase(c);
    if (c.expected_route === 'complete') {
      expect(planRating.ok).toBe(true);       // promotion allowed
      expect(result.unratedPlan).toBe(false); // NOT over-blocked (must-pass-silently)
    } else { // 'block'
      expect(planRating.ok).toBe(false);
      expect(result.unratedPlan).toBe(true);  // Gap-B block engaged
      expect(close.block).toBe(true);         // and the close-gate blocks
    }
  });
}

test('corpus contains the real #3808 miss and it is caught', () => {
  const miss = B_CASES.find((c) => c.source === '#3808');
  expect(miss).toBeTruthy();
  const { planRating } = runCase(miss);
  expect(planRating.ok).toBe(false); // #3808 caught: no receipt -> not promotable
});

test('at least one B-case must pass silently (no over-block)', () => {
  const silent = B_CASES.filter((c) => c.expected_route === 'complete');
  expect(silent.length).toBeGreaterThan(0);
  for (const c of silent) expect(runCase(c).result.unratedPlan).toBe(false);
});
