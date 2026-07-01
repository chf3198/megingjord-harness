'use strict';
// Contract tests for the harness SSoT catalog/descriptor/runtimes cross-family
// review gate added in Epic #3411 T3.3 (#3453).
// Surface: fleet-review-required.js — catalogPathRequiresReview + validateCatalogHandoff
// + validate() integration. Uses node --test (no external deps).

const { test } = require('node:test');
const assert = require('node:assert/strict');
const path = require('path');

const frr = require(path.resolve(
  __dirname, '..', 'scripts', 'global', 'megalint', 'fleet-review-required.js',
));

const AUTHOR_TEAM_MODEL = 'claude-code:sonnet@anthropic';

// ---- path detection helpers ----

test('contract: harness-feature-catalog.json triggers catalog review requirement', () => {
  assert.strictEqual(
    frr.catalogPathRequiresReview(['inventory/harness-feature-catalog.json']),
    true,
  );
});

test('contract: runtime-descriptor.schema.json triggers catalog review requirement', () => {
  assert.strictEqual(
    frr.catalogPathRequiresReview(['inventory/runtime-descriptor.schema.json']),
    true,
  );
});

test('contract: inventory/runtimes/*.json triggers catalog review requirement', () => {
  const runtimeFiles = [
    'inventory/runtimes/claude-code.json',
    'inventory/runtimes/codex.json',
    'inventory/runtimes/copilot.json',
    'inventory/runtimes/antigravity.json',
    'inventory/runtimes/cursor.json',
  ];
  for (const filePath of runtimeFiles) {
    assert.strictEqual(
      frr.catalogPathRequiresReview([filePath]),
      true,
      `expected ${filePath} to trigger catalog review`,
    );
  }
});

test('contract: non-catalog paths do not trigger catalog review requirement', () => {
  const unrelatedFiles = [
    'scripts/global/megalint/fleet-review-required.js',
    'inventory/team-model-signatures.json',
    'inventory/rubric-g1-g9-v2.json',
    'inventory/runtimes/claude-code.yaml',  // wrong extension
    'docs/howto/something.md',
    'inventory/runtimes-extra/claude-code.json', // wrong prefix
  ];
  assert.strictEqual(
    frr.catalogPathRequiresReview(unrelatedFiles),
    false,
  );
});

test('contract: empty changedFiles does not trigger catalog review', () => {
  assert.strictEqual(frr.catalogPathRequiresReview([]), false);
  assert.strictEqual(frr.catalogPathRequiresReview(null), false);
  assert.strictEqual(frr.catalogPathRequiresReview(undefined), false);
});

// ---- COLLABORATOR_HANDOFF body validation ----

const VALID_HANDOFF = [
  'cross_family_reviewer: qwen2.5-coder:32b@ollama',
  'cross_family_receipt: a1b2c3d4e5f60011',
  'cross_family_rating: 9/10',
  'cross_family_findings: no issues found',
].join('\n');

test('contract: valid handoff with 16-hex receipt and family-independent reviewer passes', () => {
  const result = frr.validateCatalogHandoff(VALID_HANDOFF, AUTHOR_TEAM_MODEL);
  assert.deepStrictEqual(result, [], 'expected no violations for a valid catalog handoff');
});

test('contract: handoff missing cross_family_reviewer is flagged', () => {
  const handoffBody = 'cross_family_receipt: a1b2c3d4e5f60011\nsome other content\n';
  const violations = frr.validateCatalogHandoff(handoffBody, AUTHOR_TEAM_MODEL);
  assert.ok(
    violations.some((violation) => violation.rule === 'catalog-review-missing-reviewer'),
    'expected catalog-review-missing-reviewer violation',
  );
});

test('contract: handoff missing cross_family_receipt is flagged', () => {
  const handoffBody = 'cross_family_reviewer: qwen2.5-coder:32b@ollama\nsome other content\n';
  const violations = frr.validateCatalogHandoff(handoffBody, AUTHOR_TEAM_MODEL);
  assert.ok(
    violations.some((violation) => violation.rule === 'catalog-review-missing-receipt'),
    'expected catalog-review-missing-receipt violation',
  );
});

test('contract: cross_family_receipt that is not 16 hex chars is flagged', () => {
  const handoffBody = [
    'cross_family_reviewer: qwen2.5-coder:32b@ollama',
    'cross_family_receipt: tooshort',  // not 16-char hex
  ].join('\n');
  const violations = frr.validateCatalogHandoff(handoffBody, AUTHOR_TEAM_MODEL);
  assert.ok(
    violations.some((violation) => violation.rule === 'catalog-review-missing-receipt'),
    'expected catalog-review-missing-receipt for malformed receipt',
  );
});

test('contract: same-family reviewer (anthropic author + anthropic reviewer) is rejected', () => {
  const handoffBody = [
    'cross_family_reviewer: claude-opus@anthropic',
    'cross_family_receipt: a1b2c3d4e5f60011',
  ].join('\n');
  const violations = frr.validateCatalogHandoff(handoffBody, AUTHOR_TEAM_MODEL);
  assert.ok(
    violations.some((violation) => violation.rule === 'catalog-review-not-cross-family'),
    'expected catalog-review-not-cross-family for same-family self-review',
  );
});

test('contract: unknown reviewer family is rejected (independence cannot be verified)', () => {
  const handoffBody = [
    'cross_family_reviewer: some-unknown-model@localhost',
    'cross_family_receipt: a1b2c3d4e5f60011',
  ].join('\n');
  const violations = frr.validateCatalogHandoff(handoffBody, AUTHOR_TEAM_MODEL);
  assert.ok(
    violations.some((violation) => violation.rule === 'catalog-review-not-cross-family'),
    'expected catalog-review-not-cross-family for unknown reviewer family',
  );
});

// ---- integrate validate() top-level function ----

test('contract: validate() flags missing receipt when changedFiles touch catalog', () => {
  const result = frr.validate({
    changedFiles: ['inventory/harness-feature-catalog.json'],
    collaboratorHandoffBody: 'cross_family_reviewer: qwen2.5-coder:32b@ollama\n',
    authorTeamModel: AUTHOR_TEAM_MODEL,
    labels: [],
  });
  assert.strictEqual(result.ok, false);
  assert.ok(
    result.violations.some((violation) => violation.rule === 'catalog-review-missing-receipt'),
    'expected catalog-review-missing-receipt violation from validate()',
  );
});

test('contract: validate() passes when catalog PR has valid handoff evidence', () => {
  const result = frr.validate({
    changedFiles: ['inventory/runtimes/claude-code.json'],
    collaboratorHandoffBody: VALID_HANDOFF,
    authorTeamModel: AUTHOR_TEAM_MODEL,
    labels: [],
  });
  assert.deepStrictEqual(result.violations, []);
  assert.strictEqual(result.ok, true);
});

test('contract: validate() is unaffected when changedFiles do not touch catalog paths', () => {
  const result = frr.validate({
    changedFiles: ['scripts/global/some-script.js', 'docs/howto/guide.md'],
    collaboratorHandoffBody: '',  // no handoff — would fail if catalog gate triggered
    authorTeamModel: AUTHOR_TEAM_MODEL,
    labels: [],
  });
  assert.strictEqual(result.ok, true, 'non-catalog PR should pass catalog gate regardless');
});

test('contract: validate() existing lane gate still works alongside catalog gate', () => {
  // area:governance lane with no review block — existing gate must still fire
  const result = frr.validate({
    labels: ['area:governance'],
    closeoutBody: 'no review here',
    authorTeamModel: AUTHOR_TEAM_MODEL,
    changedFiles: [],
  });
  assert.strictEqual(result.ok, false);
  assert.ok(
    result.violations.some((violation) => violation.rule === 'fleet-review-missing'),
    'expected fleet-review-missing from existing lane gate',
  );
});

test('contract: validate() flags both lane gate and catalog gate when both triggered', () => {
  const result = frr.validate({
    labels: ['area:governance'],
    closeoutBody: 'no review here',
    collaboratorHandoffBody: '',
    authorTeamModel: AUTHOR_TEAM_MODEL,
    changedFiles: ['inventory/runtime-descriptor.schema.json'],
  });
  assert.strictEqual(result.ok, false);
  const ruleNames = result.violations.map((violation) => violation.rule);
  assert.ok(ruleNames.includes('fleet-review-missing'), 'lane gate must fire');
  assert.ok(ruleNames.includes('catalog-review-missing-reviewer'), 'catalog gate must fire');
});

test('contract: isCatalogPath rejects non-json files in runtimes prefix', () => {
  assert.strictEqual(frr.isCatalogPath('inventory/runtimes/claude-code.yaml'), false);
  assert.strictEqual(frr.isCatalogPath('inventory/runtimes/claude-code.json'), true);
});
