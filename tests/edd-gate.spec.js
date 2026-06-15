'use strict';
const test = require('node:test');
const assert = require('node:assert');
const {
  validate,
  isExempt,
  findEddSection,
  checkEddFields,
  EXEMPT_LANES,
  EDD_REQUIRED_FIELDS,
} = require('../scripts/global/megalint/edd-required');

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
const FULL_EDD = `## EDD
scope: Add GOV-009 gate
acceptance: gate blocks missing EDD
risk: low — read-only validator
implementation-plan: add validator + workflow + tests`;

const FULL_EDD_COMMENT = { body: FULL_EDD };
const CODE_CHANGE_LABELS = ['lane:code-change', 'status:in-progress', 'type:task'];
const TRIVIAL_LABELS = ['lane:trivial'];
const CONFIG_LABELS = ['lane:config-only'];
const NO_LANE_LABELS = ['status:in-progress', 'type:task'];

// ---------------------------------------------------------------------------
// isExempt
// ---------------------------------------------------------------------------
test('isExempt: lane:trivial is exempt', () => {
  assert.strictEqual(isExempt(TRIVIAL_LABELS), true);
});
test('isExempt: lane:config-only is exempt', () => {
  assert.strictEqual(isExempt(CONFIG_LABELS), true);
});
test('isExempt: lane:docs-research is exempt', () => {
  assert.strictEqual(isExempt(['lane:docs-research']), true);
});
test('isExempt: lane:no-code-remediation is exempt', () => {
  assert.strictEqual(isExempt(['lane:no-code-remediation']), true);
});
test('isExempt: lane:code-change is NOT exempt', () => {
  assert.strictEqual(isExempt(CODE_CHANGE_LABELS), false);
});
test('isExempt: null/non-array returns false (fail-closed)', () => {
  assert.strictEqual(isExempt(null), false);
  assert.strictEqual(isExempt(undefined), false);
});

// ---------------------------------------------------------------------------
// findEddSection
// ---------------------------------------------------------------------------
test('findEddSection: finds ## EDD header', () => {
  const result = findEddSection('Some preamble\n## EDD\nscope: x');
  assert.ok(result !== null);
  assert.ok(result.includes('scope:'));
});
test('findEddSection: finds "EDD" standalone header', () => {
  const result = findEddSection('## EDD\nscope: x');
  assert.ok(result !== null);
});
test('findEddSection: finds "Engineering Design Doc" phrase', () => {
  const result = findEddSection('## Engineering Design Document\nscope: y');
  assert.ok(result !== null);
});
test('findEddSection: returns null when no EDD header', () => {
  const result = findEddSection('Just a normal PR body with no design doc');
  assert.strictEqual(result, null);
});
test('findEddSection: null/empty input returns null', () => {
  assert.strictEqual(findEddSection(null), null);
  assert.strictEqual(findEddSection(''), null);
});

// ---------------------------------------------------------------------------
// checkEddFields
// ---------------------------------------------------------------------------
test('checkEddFields: all fields present → no violations', () => {
  const violations = checkEddFields(FULL_EDD);
  assert.strictEqual(violations.length, 0);
});
test('checkEddFields: missing scope → violation', () => {
  const text = '## EDD\nacceptance: ok\nrisk: low\nimplementation-plan: x';
  const violations = checkEddFields(text);
  assert.ok(violations.some((viol) => viol.rule === 'edd-missing-field' && viol.detail.includes('scope')));
});
test('checkEddFields: missing risk → violation', () => {
  const text = '## EDD\nscope: x\nacceptance: ok\nimplementation-plan: x';
  const violations = checkEddFields(text);
  assert.ok(violations.some((viol) => viol.detail.includes('risk')));
});
test('checkEddFields: missing implementation-plan → violation', () => {
  const text = '## EDD\nscope: x\nacceptance: ok\nrisk: low';
  const violations = checkEddFields(text);
  assert.ok(violations.some((viol) => viol.detail.includes('implementation-plan')));
});
test('checkEddFields: all violations have severity hard', () => {
  const violations = checkEddFields('## EDD\nno fields here');
  assert.ok(violations.length > 0);
  assert.ok(violations.every((viol) => viol.severity === 'hard'));
});

// ---------------------------------------------------------------------------
// validate — exempt lanes
// ---------------------------------------------------------------------------
test('validate: lane:trivial → exempt=true, ok=true', () => {
  const result = validate({ labels: TRIVIAL_LABELS, prBody: '', comments: [] });
  assert.strictEqual(result.ok, true);
  assert.strictEqual(result.exempt, true);
});
test('validate: lane:config-only → exempt=true, ok=true', () => {
  const result = validate({ labels: CONFIG_LABELS, prBody: '', comments: [] });
  assert.strictEqual(result.ok, true);
  assert.strictEqual(result.exempt, true);
});

// ---------------------------------------------------------------------------
// validate — blocking (MUTATION TEST TARGET)
// This test asserts the gate BLOCKS (severity hard) when EDD is absent on
// lane:code-change. It would FAIL if someone reverted the gate to advisory.
// ---------------------------------------------------------------------------
test('MUTATION: missing EDD on lane:code-change → ok=false, hard severity', () => {
  const result = validate({ labels: CODE_CHANGE_LABELS, prBody: 'No EDD here', comments: [] });
  assert.strictEqual(result.ok, false);
  assert.strictEqual(result.exempt, false);
  // At least one violation must exist.
  assert.ok(result.violations.length > 0);
  // MUTATION SENTINEL: all violations must be severity:hard (not advisory).
  // If gate is reverted to advisory this assertion fails.
  assert.ok(
    result.violations.every((viol) => viol.severity === 'hard'),
    'Expected all EDD violations to be severity:hard (blocking), not advisory'
  );
  assert.ok(result.violations.some((viol) => viol.rule === 'edd-missing'));
});

test('MUTATION: EDD with missing fields → ok=false, hard severity', () => {
  const incompleteEdd = '## EDD\nscope: only scope here';
  const result = validate({
    labels: CODE_CHANGE_LABELS,
    prBody: incompleteEdd,
    comments: [],
  });
  assert.strictEqual(result.ok, false);
  assert.strictEqual(result.exempt, false);
  assert.ok(result.violations.length > 0);
  // MUTATION SENTINEL: must remain hard blocking, not advisory.
  assert.ok(
    result.violations.every((viol) => viol.severity === 'hard'),
    'Expected field violations to be severity:hard (blocking), not advisory'
  );
});

// ---------------------------------------------------------------------------
// validate — valid EDD in PR body
// ---------------------------------------------------------------------------
test('validate: full EDD in prBody → ok=true', () => {
  const result = validate({ labels: CODE_CHANGE_LABELS, prBody: FULL_EDD, comments: [] });
  assert.strictEqual(result.ok, true);
  assert.strictEqual(result.exempt, false);
  assert.strictEqual(result.violations.length, 0);
});

// ---------------------------------------------------------------------------
// validate — valid EDD in issue comments
// ---------------------------------------------------------------------------
test('validate: full EDD in comment trail → ok=true', () => {
  const result = validate({ labels: CODE_CHANGE_LABELS, prBody: '', comments: [FULL_EDD_COMMENT] });
  assert.strictEqual(result.ok, true);
  assert.strictEqual(result.violations.length, 0);
});

// ---------------------------------------------------------------------------
// validate — no lane label (fail-closed: treated as code-change)
// ---------------------------------------------------------------------------
test('validate: no lane label → applies gate (fail-closed), blocks absent EDD', () => {
  const result = validate({ labels: NO_LANE_LABELS, prBody: 'No EDD', comments: [] });
  assert.strictEqual(result.ok, false);
  assert.strictEqual(result.exempt, false);
});

test('validate: no lane label + full EDD → ok=true', () => {
  const result = validate({ labels: NO_LANE_LABELS, prBody: FULL_EDD, comments: [] });
  assert.strictEqual(result.ok, true);
});

// ---------------------------------------------------------------------------
// validate — invalid input (fail-closed)
// ---------------------------------------------------------------------------
test('validate: null input → ok=false (fail-closed)', () => {
  const result = validate(null);
  assert.strictEqual(result.ok, false);
  assert.ok(result.violations.some((viol) => viol.rule === 'edd-gate-invalid-input'));
});
test('validate: undefined input → ok=false (fail-closed)', () => {
  const result = validate(undefined);
  assert.strictEqual(result.ok, false);
});

// ---------------------------------------------------------------------------
// validate — empty corpus (fail-closed)
// ---------------------------------------------------------------------------
test('validate: empty prBody and empty comments → ok=false (fail-closed)', () => {
  const result = validate({ labels: CODE_CHANGE_LABELS, prBody: '', comments: [] });
  assert.strictEqual(result.ok, false);
  assert.ok(result.violations.some((viol) => viol.rule === 'edd-missing'));
});

// ---------------------------------------------------------------------------
// validate — EDD field case-insensitivity
// ---------------------------------------------------------------------------
test('validate: EDD field labels are case-insensitive', () => {
  const mixedCase = `## EDD
Scope: x
Acceptance: y
Risk: z
Implementation-Plan: a`;
  const result = validate({ labels: CODE_CHANGE_LABELS, prBody: mixedCase, comments: [] });
  assert.strictEqual(result.ok, true);
});

// ---------------------------------------------------------------------------
// Adversarial: injected EDD-like text in non-EDD prose should not satisfy gate
// ---------------------------------------------------------------------------
test('ADVERSARIAL: "scope:" in random prose without EDD header → not found', () => {
  const proseOnly = 'The scope of this PR is to fix a bug. Risk is low. Acceptance pending.';
  const section = findEddSection(proseOnly);
  // No EDD header means findEddSection returns null.
  assert.strictEqual(section, null);
  const result = validate({ labels: CODE_CHANGE_LABELS, prBody: proseOnly, comments: [] });
  assert.strictEqual(result.ok, false);
});

// ---------------------------------------------------------------------------
// Constant exports sanity
// ---------------------------------------------------------------------------
test('EXEMPT_LANES includes the four documented exempt lanes', () => {
  assert.ok(EXEMPT_LANES.has('lane:trivial'));
  assert.ok(EXEMPT_LANES.has('lane:config-only'));
  assert.ok(EXEMPT_LANES.has('lane:docs-research'));
  assert.ok(EXEMPT_LANES.has('lane:no-code-remediation'));
});
test('EDD_REQUIRED_FIELDS has all four required fields', () => {
  assert.ok(EDD_REQUIRED_FIELDS.includes('scope'));
  assert.ok(EDD_REQUIRED_FIELDS.includes('acceptance'));
  assert.ok(EDD_REQUIRED_FIELDS.includes('risk'));
  assert.ok(EDD_REQUIRED_FIELDS.includes('implementation-plan'));
});
