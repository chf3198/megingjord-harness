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

  test('ALLOWED_STRATEGIES enum has all 11', () => {
    expect(ALLOWED_STRATEGIES.length).toBe(11);
    expect(ALLOWED_STRATEGIES).toContain('tdd-pyramid');
    expect(ALLOWED_STRATEGIES).toContain('none');
  });
});

test.describe('test-evidence-validator #3276 — pytest evidence for tdd-pyramid Python hooks', () => {
  const fs = require('node:fs');
  const base = { comments: [], lane: 'lane:code-change' };
  const PY_SOURCE = 'hooks/scripts/push_counter.py';
  const PY_SPEC = 'tests/hooks/test_push_counter.py';
  const PY_SPEC_ALT = 'tests/hooks/push_counter_test.py';
  const JS_SPEC = 'tests/push.spec.js';

  // AC1 + AC5: python source + pytest spec → PASS with distinct reason token (G8 attributability).
  test('AC1/AC5: python source + pytest spec passes via python path with distinct reason', () => {
    const r = validate({ ...base, test_strategy: 'tdd-pyramid', pr_files: [PY_SOURCE, PY_SPEC] });
    expect(r.ok).toBe(true);
    expect(r.reason).toBe('python-pytest-evidence');
  });

  test('AC1: *_test.py naming also accepted', () => {
    const r = validate({ ...base, test_strategy: 'tdd-pyramid', pr_files: [PY_SOURCE, PY_SPEC_ALT] });
    expect(r.ok).toBe(true);
    expect(r.reason).toBe('python-pytest-evidence');
  });

  // AC2/AC4(b): python source + no test → FAIL.
  test('AC2: python source with no test fails', () => {
    const r = validate({ ...base, test_strategy: 'tdd-pyramid', pr_files: [PY_SOURCE] });
    expect(r.ok).toBe(false);
    expect(r.violations[0].rule).toBe('missing-spec-file');
  });

  // AC2/AC4(e): pytest spec but NO python source → FAIL (no false positive).
  test('AC2: pytest spec without python source fails (no false positive)', () => {
    const r = validate({ ...base, test_strategy: 'tdd-pyramid', pr_files: [PY_SPEC, 'scripts/global/foo.js'] });
    expect(r.ok).toBe(false);
  });

  // AC4(c): JS regression — JS path unchanged, original reason token preserved.
  test('AC4: JS source + JS spec still passes with evidence-present reason', () => {
    const r = validate({ ...base, test_strategy: 'tdd-pyramid', pr_files: ['scripts/global/foo.js', JS_SPEC] });
    expect(r.ok).toBe(true);
    expect(r.reason).toBe('evidence-present');
  });

  // AC4(d): mixed JS+py source + only pytest → PASS.
  test('AC4: mixed JS+py source with only pytest spec passes', () => {
    const r = validate({ ...base, test_strategy: 'tdd-pyramid',
      pr_files: ['scripts/global/foo.js', PY_SOURCE, PY_SPEC] });
    expect(r.ok).toBe(true);
  });

  // AC4(g): tdd-trophy delegation locks the same python-pytest acceptance.
  test('AC4: tdd-trophy delegates to the same python-pytest acceptance', () => {
    const r = validate({ ...base, test_strategy: 'tdd-trophy', pr_files: [PY_SOURCE, PY_SPEC] });
    expect(r.ok).toBe(true);
    expect(r.reason).toBe('python-pytest-evidence');
  });

  // AC4(f): malformed / edge-case paths never crash; degrade to no-match (G6 resilience).
  test('AC4: edge-case paths do not crash', () => {
    const edgeSets = [
      [],
      ['noextensionfile'],
      ['tests/hooks/tést_unicodé.py'],
      ['hooks/scripts/with space.py', 'tests/hooks/test_x.py'],
      ['hooks/scripts/deleted_only.py'],
    ];
    for (const files of edgeSets) {
      expect(() => validate({ ...base, test_strategy: 'tdd-pyramid', pr_files: files })).not.toThrow();
    }
    // space-in-source + pytest spec is a valid python diff → passes.
    expect(validate({ ...base, test_strategy: 'tdd-pyramid',
      pr_files: ['hooks/scripts/with space.py', 'tests/hooks/test_x.py'] }).ok).toBe(true);
    // empty set fails the python path.
    expect(validate({ ...base, test_strategy: 'tdd-pyramid', pr_files: [] }).ok).toBe(false);
  });

  // AC3: doclint — the methodology matrix tdd-pyramid evidence row mentions a pytest artifact.
  test('AC3: matrix tdd-pyramid evidence row mentions a pytest artifact', () => {
    const matrix = fs.readFileSync(
      path.resolve(__dirname, '../instructions/test-methodology-matrix.instructions.md'), 'utf8');
    const lines = matrix.split('\n');
    const evidenceRow = lines.find(l => /^\|\s*`tdd-pyramid`\s*\|/.test(l));
    expect(evidenceRow).toBeTruthy();
    expect(/test_\*\.py|pytest|_test\.py/i.test(evidenceRow)).toBe(true);
    // tdd-trophy delegates to the same checker — ensure the python-hook surface still maps to tdd-pyramid.
    const surfaceRow = lines.find(l => /hooks\/scripts\/\*\.py/.test(l));
    expect(/tdd-pyramid/.test(surfaceRow || '')).toBe(true);
  });
});
