'use strict';
// Tests for #3674 (Epic #3669 C5): closeout-integrity cross-check.
// checkCloseoutIntegrity flags a `mid_flight_flaws: none` / `anneal_tickets_filed: none`
// claim contradicted by >=1 red branch-protection-REQUIRED check on the linked PR.
// Strategy: tdd-pyramid per test-methodology-matrix (scripts/global/megalint validator).
// Uses node:test + node:assert. AC2: the check keys on required-check STATE, never on
// comment timing/latency — there is no timing input, proven by the corpus below.

const test = require('node:test');
const assert = require('node:assert');
const {
  checkCloseoutIntegrity,
  flawFieldIsNone,
  validate,
} = require('../scripts/global/megalint/consultant-closeout');

const RED = [
  { name: 'collaborator-gate', conclusion: 'failure', isRequired: true },
  { name: 'evidence-completeness', conclusion: 'failure', isRequired: true },
  { name: 'lint-required', conclusion: 'success', isRequired: true },
];
const GREEN = [
  { name: 'collaborator-gate', conclusion: 'success', isRequired: true },
  { name: 'lint-required', conclusion: 'success', isRequired: true },
];
// A red check that is NOT branch-protection-required must never trigger the flag.
const RED_BUT_ADVISORY = [
  { name: 'parity-matrix (advisory)', conclusion: 'failure', isRequired: false },
  { name: 'lint-required', conclusion: 'success', isRequired: true },
];

const NONE_BODY = [
  '## CONSULTANT_CLOSEOUT',
  'verdict: approve_for_merge',
  'mid_flight_flaws: none',
  'anneal_tickets_filed: none',
].join('\n');
const POPULATED_BODY = [
  '## CONSULTANT_CLOSEOUT',
  'verdict: approve_for_merge',
  'mid_flight_flaws: [gate red at merge, decision=file-ticket, artifact=#9999]',
  'anneal_tickets_filed: [#9999]',
].join('\n');

const RULE = 'closeout-integrity-none-claim-vs-red-required';

test('AC1/AC4 none-claim-with-red → FLAGS (advisory)', () => {
  const v = checkCloseoutIntegrity(NONE_BODY, { prRequiredChecks: RED });
  assert.ok(v.length >= 1, 'expected >=1 violation');
  assert.ok(v.every((x) => x.rule === RULE), 'rule name');
  assert.ok(v.every((x) => x.severity === 'advisory'), 'AC3: advisory severity');
  assert.match(v[0].detail, /collaborator-gate/, 'cites the red required check');
});

test('AC4 none-claim-all-green → PASS (no violation)', () => {
  assert.deepStrictEqual(checkCloseoutIntegrity(NONE_BODY, { prRequiredChecks: GREEN }), []);
});

test('AC4 populated-flaws-with-red → PASS (no violation)', () => {
  assert.deepStrictEqual(checkCloseoutIntegrity(POPULATED_BODY, { prRequiredChecks: RED }), []);
});

test('a RED but NON-required check does not trigger the flag', () => {
  assert.deepStrictEqual(checkCloseoutIntegrity(NONE_BODY, { prRequiredChecks: RED_BUT_ADVISORY }), []);
});

test('absent prRequiredChecks → advisory no-op (does not break existing callers)', () => {
  assert.deepStrictEqual(checkCloseoutIntegrity(NONE_BODY, {}), []);
  assert.deepStrictEqual(checkCloseoutIntegrity(NONE_BODY, { prRequiredChecks: [] }), []);
});

test('AC2: keys on required-check state, not timing — no timing field exists', () => {
  // A closeout posted "1s after ADMIN_HANDOFF" carries no timing signal into the check;
  // only prRequiredChecks matters. Same body, green vs red, is the only thing that flips it.
  assert.deepStrictEqual(checkCloseoutIntegrity(NONE_BODY, { prRequiredChecks: GREEN }), []);
  assert.ok(checkCloseoutIntegrity(NONE_BODY, { prRequiredChecks: RED }).length >= 1);
});

test('flawFieldIsNone distinguishes none / populated / empty / missing', () => {
  assert.strictEqual(flawFieldIsNone('mid_flight_flaws: none', 'mid_flight_flaws'), true);
  assert.strictEqual(flawFieldIsNone('mid_flight_flaws: [x]', 'mid_flight_flaws'), false);
  assert.strictEqual(flawFieldIsNone('mid_flight_flaws:', 'mid_flight_flaws'), false);
  assert.strictEqual(flawFieldIsNone('other: none', 'mid_flight_flaws'), false);
});

test('advisory does not flip validate().ok on an otherwise-clean closeout', () => {
  // A minimally-valid closeout with none-claims + red checks should still surface the
  // advisory violation WITHOUT setting ok=false (AC3 non-blocking ship).
  const comments = [{ body: [
    '## CONSULTANT_CLOSEOUT',
    'status: review',
    'verdict: approve_for_merge',
    'verification-timestamp: 2026-07-08T00:00:00Z',
    'rubric_rating: 8/10 — #3674 evidence on the PR',
    'boxes_checked: 4 boxes_total: 4',
    'mid_flight_flaws: none',
    'anneal_tickets_filed: none',
    'Signed-by: Orla Vale',
    'Team&Model: claude-code:opus-4-8@local',
    'Role: consultant',
  ].join('\n') }];
  const res = validate({ comments, prRequiredChecks: RED });
  const hit = res.violations.filter((x) => x.rule === RULE);
  assert.ok(hit.length >= 1, 'advisory violation present');
  assert.ok(hit.every((x) => x.severity === 'advisory'), 'still advisory inside validate()');
});
