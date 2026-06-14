'use strict';
// Tests for #2909: promotion of anneal_tickets_filed and mid_flight_flaws
// from advisory-only to hard-blocking in consultant-closeout.js.
// Strategy: tdd-pyramid per test-methodology-matrix (scripts/global/megalint validator).
// Uses node:test + node:assert — no playwright, no mocks of the blocking path.

const test = require('node:test');
const assert = require('node:assert');
const {
  checkRequiredFlawFields,
  validate,
} = require('../scripts/global/megalint/consultant-closeout');

// ---------------------------------------------------------------------------
// Unit tests for checkRequiredFlawFields
// ---------------------------------------------------------------------------

test('checkRequiredFlawFields: both fields present with values → no violations', () => {
  const body = [
    'anneal_tickets_filed: none',
    'mid_flight_flaws: none',
  ].join('\n');
  const viols = checkRequiredFlawFields(body);
  assert.strictEqual(viols.length, 0);
});

test('checkRequiredFlawFields: anneal_tickets_filed with ticket list → no violations', () => {
  const body = [
    'anneal_tickets_filed: [#123, #456]',
    'mid_flight_flaws: none',
  ].join('\n');
  const viols = checkRequiredFlawFields(body);
  assert.strictEqual(viols.length, 0);
});

test('checkRequiredFlawFields: mid_flight_flaws with list value → no violations', () => {
  const body = [
    'anneal_tickets_filed: none',
    'mid_flight_flaws: [lint-miss, decision=file-ticket, artifact=#99]',
  ].join('\n');
  const viols = checkRequiredFlawFields(body);
  assert.strictEqual(viols.length, 0);
});

// MUTATION tests — these assert the promoted BLOCKING behavior and would fail
// if checkRequiredFlawFields were removed or made advisory-only.

test('MUTATION: missing anneal_tickets_filed → blocking violation emitted', () => {
  const body = 'mid_flight_flaws: none\nSome other content';
  const viols = checkRequiredFlawFields(body);
  const rules = viols.map(v => v.rule);
  assert.ok(rules.includes('missing-anneal-tickets-filed'),
    `expected missing-anneal-tickets-filed in [${rules.join(', ')}]`);
  // Critically: no severity:'advisory' — this is a hard block.
  const annealViol = viols.find(v => v.rule === 'missing-anneal-tickets-filed');
  assert.strictEqual(annealViol.severity, undefined,
    'missing-anneal-tickets-filed must be hard-blocking (no severity:advisory)');
});

test('MUTATION: missing mid_flight_flaws → blocking violation emitted', () => {
  const body = 'anneal_tickets_filed: none\nSome other content';
  const viols = checkRequiredFlawFields(body);
  const rules = viols.map(v => v.rule);
  assert.ok(rules.includes('missing-mid-flight-flaws'),
    `expected missing-mid-flight-flaws in [${rules.join(', ')}]`);
  const flawViol = viols.find(v => v.rule === 'missing-mid-flight-flaws');
  assert.strictEqual(flawViol.severity, undefined,
    'missing-mid-flight-flaws must be hard-blocking (no severity:advisory)');
});

test('MUTATION: both fields missing → two blocking violations', () => {
  const body = 'verdict: approve\nG1: 8\nSigned-by: Orla Vale';
  const viols = checkRequiredFlawFields(body);
  assert.strictEqual(viols.length, 2, 'should emit exactly two violations when both fields absent');
  const rules = viols.map(v => v.rule);
  assert.ok(rules.includes('missing-anneal-tickets-filed'));
  assert.ok(rules.includes('missing-mid-flight-flaws'));
  // Neither is advisory.
  for (const viol of viols) {
    assert.strictEqual(viol.severity, undefined,
      `violation ${viol.rule} must not carry severity:'advisory'`);
  }
});

test('MUTATION: anneal_tickets_filed present but empty value → blocking', () => {
  // "anneal_tickets_filed:" with nothing after is an empty declaration — still blocking.
  const body = 'anneal_tickets_filed:   \nmid_flight_flaws: none';
  const viols = checkRequiredFlawFields(body);
  const rules = viols.map(v => v.rule);
  assert.ok(
    rules.includes('empty-anneal-tickets-filed') || rules.includes('missing-anneal-tickets-filed'),
    `expected empty/missing-anneal-tickets-filed in [${rules.join(', ')}]`
  );
  const relevant = viols.find(v =>
    v.rule === 'empty-anneal-tickets-filed' || v.rule === 'missing-anneal-tickets-filed');
  assert.strictEqual(relevant.severity, undefined, 'empty anneal_tickets_filed must be hard-blocking');
});

test('MUTATION: mid_flight_flaws present but empty value → blocking', () => {
  const body = 'anneal_tickets_filed: none\nmid_flight_flaws:   ';
  const viols = checkRequiredFlawFields(body);
  const rules = viols.map(v => v.rule);
  assert.ok(
    rules.includes('empty-mid-flight-flaws') || rules.includes('missing-mid-flight-flaws'),
    `expected empty/missing-mid-flight-flaws in [${rules.join(', ')}]`
  );
  const relevant = viols.find(v =>
    v.rule === 'empty-mid-flight-flaws' || v.rule === 'missing-mid-flight-flaws');
  assert.strictEqual(relevant.severity, undefined, 'empty mid_flight_flaws must be hard-blocking');
});

// ---------------------------------------------------------------------------
// Integration tests: validate() returns ok:false when flaw fields absent
// ---------------------------------------------------------------------------

// Minimal valid body helper — satisfies all other required fields.
function minimalBody(overrides = '') {
  return [
    'CONSULTANT_CLOSEOUT',
    'verdict: approve_for_merge',
    'G1: 8 G2: 8 G3: 8 G4: 8 G5: 8 G6: 8 G7: 8 G8: 8 G9: 8',
    'verification-timestamp: 2026-06-14T12:00:00Z',
    'Signed-by: Orla Vale',
    'Team&Model: claude-code:claude-sonnet-4-6@anthropic',
    'Role: consultant',
    'anneal_tickets_filed: none',
    'mid_flight_flaws: none',
    overrides,
  ].join('\n');
}

function makeComments(body) {
  return [{ body }];
}

test('validate: complete closeout with both flaw fields → ok:true', () => {
  const result = validate({ comments: makeComments(minimalBody()) });
  assert.strictEqual(result.found, true);
  const hardViols = (result.violations || []).filter(v => v.severity !== 'advisory');
  assert.strictEqual(hardViols.length, 0,
    `unexpected hard violations: ${hardViols.map(v => v.rule).join(', ')}`);
  assert.strictEqual(result.ok, true);
});

test('MUTATION: validate() ok:false when anneal_tickets_filed absent', () => {
  const body = minimalBody().replace(/anneal_tickets_filed.*\n?/, '');
  const result = validate({ comments: makeComments(body) });
  assert.strictEqual(result.ok, false,
    'validate() must return ok:false when anneal_tickets_filed is absent');
  const rules = (result.violations || []).map(v => v.rule);
  assert.ok(rules.includes('missing-anneal-tickets-filed'),
    `expected missing-anneal-tickets-filed in violations: [${rules.join(', ')}]`);
});

test('MUTATION: validate() ok:false when mid_flight_flaws absent', () => {
  const body = minimalBody().replace(/mid_flight_flaws.*\n?/, '');
  const result = validate({ comments: makeComments(body) });
  assert.strictEqual(result.ok, false,
    'validate() must return ok:false when mid_flight_flaws is absent');
  const rules = (result.violations || []).map(v => v.rule);
  assert.ok(rules.includes('missing-mid-flight-flaws'),
    `expected missing-mid-flight-flaws in violations: [${rules.join(', ')}]`);
});

test('MUTATION: validate() ok:false when both flaw fields absent', () => {
  const body = minimalBody()
    .replace(/anneal_tickets_filed.*\n?/, '')
    .replace(/mid_flight_flaws.*\n?/, '');
  const result = validate({ comments: makeComments(body) });
  assert.strictEqual(result.ok, false,
    'validate() must return ok:false when both flaw fields absent');
  const rules = (result.violations || []).map(v => v.rule);
  assert.ok(rules.includes('missing-anneal-tickets-filed'));
  assert.ok(rules.includes('missing-mid-flight-flaws'));
});

test('advisory-only violations do not flip ok to false', () => {
  // rubric_provisional + no structured rubric = advisory only; flaw fields present.
  const body = [
    'CONSULTANT_CLOSEOUT',
    'verdict: approve_for_merge',
    'rubric_provisional: true',
    'G1: 8',
    'verification-timestamp: 2026-06-14T12:00:00Z',
    'Signed-by: Orla Vale',
    'Team&Model: claude-code:claude-sonnet-4-6@anthropic',
    'Role: consultant',
    'anneal_tickets_filed: none',
    'mid_flight_flaws: none',
  ].join('\n');
  const result = validate({ comments: makeComments(body) });
  const hardViols = (result.violations || []).filter(v => v.severity !== 'advisory');
  assert.strictEqual(hardViols.length, 0,
    `unexpected hard violations: ${hardViols.map(v => v.rule).join(', ')}`);
  assert.strictEqual(result.ok, true,
    'advisory-only violations must not set ok:false');
});

// ---------------------------------------------------------------------------
// Scope-correctness: unrelated closeouts (batch sibling form) still pass
// ---------------------------------------------------------------------------

test('batch-sibling closeout form still satisfies flaw fields if declared', () => {
  const body = [
    '## CONSULTANT_CLOSEOUT',
    'ticket: #999 (resolved as part of batch with #800)',
    'status: review',
    'verdict: approve_for_merge',
    'verification-timestamp: 2026-06-14T12:00:00Z',
    'rubric_rating: 8/10. Full evidence on #800.',
    'Signed-by: Orla Vale',
    'Team&Model: claude-code:claude-sonnet-4-6@anthropic',
    'Role: consultant',
    'anneal_tickets_filed: none',
    'mid_flight_flaws: none',
  ].join('\n');
  const viols = checkRequiredFlawFields(body);
  assert.strictEqual(viols.length, 0, 'batch sibling with flaw fields declared → no flaw violations');
});
