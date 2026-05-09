'use strict';
const { test, expect } = require('@playwright/test');
const path = require('node:path');
const { validate, ALLOWED_STRATEGIES, NONE_PERMITTED_LANES } = require(
  path.resolve(__dirname, '../scripts/global/test-evidence-validator.js')
);

test.describe('test-evidence-validator (#1214)', () => {
  const base = { comments: [], pr_files: [] };

  test('strategy=none: permitted lanes pass, code-change fails', () => {
    for (const lane of NONE_PERMITTED_LANES) {
      expect(validate({ ...base, test_strategy: 'none', lane }).ok).toBe(true);
    }
    const r = validate({ ...base, test_strategy: 'none', lane: 'lane:code-change' });
    expect(r.ok).toBe(false);
    expect(r.violations[0].rule).toMatch(/none-disallowed/);
  });

  test('tdd-pyramid passes when spec file in pr_files', () => {
    const r = validate({ ...base, test_strategy: 'tdd-pyramid', lane: 'lane:code-change',
      pr_files: ['tests/foo.spec.js', 'scripts/foo.js'] });
    expect(r.ok).toBe(true);
  });

  test('tdd-pyramid fails without spec file', () => {
    const r = validate({ ...base, test_strategy: 'tdd-pyramid', lane: 'lane:code-change',
      pr_files: ['scripts/foo.js'] });
    expect(r.ok).toBe(false);
  });

  test('tdd-trophy uses pyramid logic', () => {
    const r = validate({ ...base, test_strategy: 'tdd-trophy', lane: 'lane:code-change',
      pr_files: ['tests/foo.spec.js'] });
    expect(r.ok).toBe(true);
  });

  test('contract-test passes with cloudflare/**/test.ts or contract spec', () => {
    expect(validate({ ...base, test_strategy: 'contract-test', lane: 'lane:code-change',
      pr_files: ['cloudflare/hamr/test.ts'] }).ok).toBe(true);
    expect(validate({ ...base, test_strategy: 'contract-test', lane: 'lane:code-change',
      pr_files: ['tests/quota.contract.spec.js'] }).ok).toBe(true);
  });

  test('contract-test fails without artifact', () => {
    const r = validate({ ...base, test_strategy: 'contract-test', lane: 'lane:code-change',
      pr_files: ['cloudflare/hamr/routes/quota.ts'] });
    expect(r.ok).toBe(false);
  });

  test('golden-file passes with tests/fixtures/**', () => {
    const r = validate({ ...base, test_strategy: 'golden-file', lane: 'lane:code-change',
      pr_files: ['tests/fixtures/issue-123.json'] });
    expect(r.ok).toBe(true);
  });

  test('eval-harness passes with tests/eval/**', () => {
    const r = validate({ ...base, test_strategy: 'eval-harness', lane: 'lane:code-change',
      pr_files: ['tests/eval/agent-foo.json'] });
    expect(r.ok).toBe(true);
  });

  test('visual-regression passes with VISUAL_QA_EVIDENCE in trail', () => {
    const r = validate({ ...base, test_strategy: 'visual-regression', lane: 'lane:code-change',
      comments: [{ body: 'check passed\nVISUAL_QA_EVIDENCE\nverdict: pass' }] });
    expect(r.ok).toBe(true);
  });

  test('drift-lint passes with docs-drift-maintenance citation', () => {
    const r = validate({ ...base, test_strategy: 'drift-lint', lane: 'lane:docs-research',
      comments: [{ body: 'ran docs-drift-maintenance skill, no drift found' }] });
    expect(r.ok).toBe(true);
  });

  test('peer-review passes with rubric_rating ≥7', () => {
    expect(validate({ ...base, test_strategy: 'peer-review', lane: 'lane:docs-research',
      comments: [{ body: 'CONSULTANT_CLOSEOUT\nrubric_rating: 9/10' }] }).ok).toBe(true);
    expect(validate({ ...base, test_strategy: 'peer-review', lane: 'lane:docs-research',
      comments: [{ body: 'CONSULTANT_CLOSEOUT\nrubric_rating: 6/10' }] }).ok).toBe(false);
  });

  test('manual-verify passes with before/after value cited', () => {
    const r = validate({ ...base, test_strategy: 'manual-verify', lane: 'lane:config-only',
      comments: [{ body: 'before: timeout=30s, after: timeout=60s, rationale: …' }] });
    expect(r.ok).toBe(true);
  });

  test('unknown strategy rejected', () => {
    const r = validate({ ...base, test_strategy: 'fuzz-testing', lane: 'lane:code-change' });
    expect(r.ok).toBe(false);
    expect(r.violations[0].rule).toMatch(/unknown-strategy/);
  });

  test('ALLOWED_STRATEGIES enum has all 10', () => {
    expect(ALLOWED_STRATEGIES.length).toBe(10);
    expect(ALLOWED_STRATEGIES).toContain('tdd-pyramid');
    expect(ALLOWED_STRATEGIES).toContain('none');
  });
});
