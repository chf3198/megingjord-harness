'use strict';
// tests/collaborator-handoff-cross-family.spec.js
// Refs #2439 — validates cross-family blocking fields + family independence check.

const { test, describe } = require('node:test');
const assert = require('node:assert');
const path = require('path');
const { validate } = require(path.join(__dirname, '..', 'scripts', 'global',
  'megalint', 'collaborator-handoff.js'));

const validBody = `## COLLABORATOR_HANDOFF
Signed-by: Soren Harper
Team&Model: copilot:claude-sonnet-4-6@github
Role: collaborator
cross_family_reviewer: qwen2.5-coder:7b@fleet-tailscale
cross_family_rating: 82/100
cross_family_findings: No major issues found.
reviewer_family: qwen
doc-coverage:
  N/A: all surfaces — lane test only`;

const makeInput = body => ({
  lane: 'lane:code-change',
  comments: [{ body, user: { login: 'test' } }],
  labels: [],
});

describe('collaborator-handoff cross-family fields (#2439)', () => {
  test('valid cross-family handoff passes', () => {
    const r = validate(makeInput(validBody));
    const blocking = (r.violations || []).filter(v => v.severity !== 'advisory');
    assert.ok(blocking.length === 0, `Expected no blocking violations; got: ${
      blocking.map(v => v.rule).join(', ')}`);
  });

  test('missing cross_family_reviewer is blocking', () => {
    const body = validBody.replace(/cross_family_reviewer:[^\n]+\n/, '');
    const r = validate(makeInput(body));
    const rules = r.violations.map(v => v.rule);
    assert.ok(rules.includes('missing-cross-family-reviewer'), 'Expected missing-cross-family-reviewer');
    assert.ok(!r.ok);
  });

  test('missing cross_family_rating is blocking', () => {
    const body = validBody.replace(/cross_family_rating:[^\n]+\n/, '');
    const r = validate(makeInput(body));
    const rules = r.violations.map(v => v.rule);
    assert.ok(rules.includes('missing-cross-family-rating'), 'Expected missing-cross-family-rating');
    assert.ok(!r.ok);
  });

  test('missing cross_family_findings is blocking', () => {
    const body = validBody.replace(/cross_family_findings:[^\n]+\n/, '');
    const r = validate(makeInput(body));
    const rules = r.violations.map(v => v.rule);
    assert.ok(rules.includes('missing-cross-family-findings'), 'Expected missing-cross-family-findings');
    assert.ok(!r.ok);
  });

  test('same-family reviewer is blocking', () => {
    const body = validBody.replace('qwen2.5-coder:7b@fleet-tailscale',
      'claude-haiku-3-5@anthropic');
    const r = validate(makeInput(body));
    const rules = r.violations.map(v => v.rule);
    assert.ok(rules.includes('cross-family-reviewer-same-family'),
      `Expected cross-family-reviewer-same-family; got: ${rules.join(', ')}`);
    assert.ok(!r.ok);
  });

  test('cross-family fields optional on non-code-change lane', () => {
    const input = { lane: 'lane:docs-research', comments: [{ body: validBody }], labels: [] };
    const r = validate(input);
    assert.ok(r.ok, `lane:docs-research should skip cross-family check`);
  });
});
