// Rubric v3 (G1-G10) tests per #1967.
// Lane: code-change. test_strategy: tdd-pyramid.
// Validates G10 Maintainability evidence boxes + scorer backward compat with v2.

const { test, expect } = require('@playwright/test');
const path = require('path');
const fs = require('fs');
const { scoreRubric, validateRubric } = require(path.resolve(__dirname, '..', 'scripts', 'global', 'rubric-score.js'));

const V3_PATH = path.resolve(__dirname, '..', 'inventory', 'rubric-g1-g10-v3.json');
const V2_PATH = path.resolve(__dirname, '..', 'inventory', 'rubric-g1-g9-v2.json');

function loadRubric(p) {
  return JSON.parse(fs.readFileSync(p, 'utf8'));
}

test('v3 rubric file declares version g1-g10-v3', () => {
  const r = loadRubric(V3_PATH);
  expect(r.version).toBe('g1-g10-v3');
});

test('v3 rubric carries G10 with at least 3 evidence boxes (#1575 AC6)', () => {
  const r = loadRubric(V3_PATH);
  expect(r.goals.G10).toBeDefined();
  expect(r.goals.G10.title).toBe('Maintainability');
  expect(Array.isArray(r.goals.G10.boxes)).toBe(true);
  expect(r.goals.G10.boxes.length).toBeGreaterThanOrEqual(3);
});

test('v3 rubric G10 box ids cover lines-cap + complexity + test-plan', () => {
  const r = loadRubric(V3_PATH);
  const ids = r.goals.G10.boxes.map((b) => b.id);
  expect(ids).toContain('g10-lines-cap-pass');
  expect(ids).toContain('g10-complexity-pass');
  expect(ids).toContain('g10-test-plan-declared');
});

test('validateRubric accepts v3 (10 goals) and v2 (9 goals)', () => {
  const v3 = loadRubric(V3_PATH);
  const v2 = loadRubric(V2_PATH);
  expect(validateRubric(v3).ok).toBe(true);
  expect(validateRubric(v2).ok).toBe(true);
});

test('scoreRubric on v3 returns 10 per-goal scores', () => {
  const v3 = loadRubric(V3_PATH);
  const ctx = {
    trail: 'test_strategy: tdd-pyramid\nMANAGER_HANDOFF COLLABORATOR_HANDOFF ADMIN_HANDOFF CONSULTANT_CLOSEOUT\nstatus:review\nHAMR\nvalidation gates\ncross-team\nscope bounded',
    diff: 'tests/sample.spec.js\nscripts/global/foo.js',
    closeout: 'Signed-by: x\nTeam&Model: y\nRole: consultant\nverification-timestamp: now\nprivacy reviewed\nrepo-local relative path\ndegraded fallback compat legacy v2\nboxes_checked\nmean\nno dead code',
  };
  const out = scoreRubric(v3, ctx);
  expect(out.rubric_version).toBe('g1-g10-v3');
  expect(Object.keys(out.goals).length).toBe(10);
  expect(out.goals.G10).toBeDefined();
});

test('scoreRubric on v2 still works (backward compat)', () => {
  const v2 = loadRubric(V2_PATH);
  const ctx = {
    trail: 'MANAGER_HANDOFF COLLABORATOR_HANDOFF ADMIN_HANDOFF CONSULTANT_CLOSEOUT\nstatus:review\nHAMR\nvalidation gates\ncross-team\nscope bounded',
    diff: 'tests/sample.spec.js\nscripts/global/foo.js',
    closeout: 'Signed-by: x\nTeam&Model: y\nRole: consultant\nverification-timestamp: now\nprivacy reviewed\nrepo-local relative path\ndegraded fallback compat legacy v1\nboxes_checked\nmean',
  };
  const out = scoreRubric(v2, ctx);
  expect(out.rubric_version).toBe('g1-g9-v3'); // bumped from v2 in #2136
  expect(Object.keys(out.goals).length).toBe(9);
});

test('G10 lines-cap box detects FAIL signal in trail', () => {
  const v3 = loadRubric(V3_PATH);
  const failCtx = {
    trail: 'lint output: file X exceed 100-line cap',
    diff: '',
    closeout: '',
  };
  const out = scoreRubric(v3, failCtx);
  const linesCap = out.goals.G10.boxes.find((b) => b.id === 'g10-lines-cap-pass');
  expect(linesCap.ok).toBe(false);
});

test('G10 test-plan-declared box accepts all 10 strategy values', () => {
  const v3 = loadRubric(V3_PATH);
  const strategies = ['tdd-pyramid', 'tdd-trophy', 'contract-test', 'golden-file',
    'eval-harness', 'visual-regression', 'drift-lint', 'peer-review', 'manual-verify', 'stress-test'];
  for (const s of strategies) {
    const out = scoreRubric(v3, { trail: `test_strategy: ${s}\n`, diff: '', closeout: '' });
    const box = out.goals.G10.boxes.find((b) => b.id === 'g10-test-plan-declared');
    expect.soft(box.ok).toBe(true);
  }
});

test('scorer mean averages across all 10 goals', () => {
  const v3 = loadRubric(V3_PATH);
  const out = scoreRubric(v3, { trail: '', diff: '', closeout: '' });
  expect(typeof out.mean).toBe('number');
  expect(out.mean).toBeGreaterThanOrEqual(0);
  expect(out.mean).toBeLessThanOrEqual(10);
});
