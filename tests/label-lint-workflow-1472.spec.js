// Regression tests for #1472 changes to .github/workflows/label-lint.yml:
//   1. Diagnostic logging line added for every close-protection decision.
//   2. Phase 2 role-cleanup respects Rule E2 (Epic always carries role:manager).
// Golden-file style — verifies the YAML contains the specific guards.
const { test, expect } = require('@playwright/test');
const fs = require('fs');
const path = require('path');

const WORKFLOW = fs.readFileSync(
  path.resolve(__dirname, '..', '.github', 'workflows', 'label-lint.yml'),
  'utf8',
);

test('#1472 AC1: workflow logs every close-protection decision with reason', () => {
  expect(WORKFLOW).toContain('close-protection decision=');
  expect(WORKFLOW).toContain('reason=${decision.reason}');
  expect(WORKFLOW).toContain('(#1472)');
});

test('#1472 AC2: Phase 2 role-cleanup respects Rule E2 — Epic always retains role:manager', () => {
  expect(WORKFLOW).toMatch(/const isEpic = labels\.includes\(['"]type:epic['"]\)/);
  expect(WORKFLOW).toMatch(/if \(isEpic && role === ['"]role:manager['"]\) continue/);
});

test('#1472 AC3: the diagnostic log appears BEFORE the auto-transition branch (so noop reasons are visible)', () => {
  const decisionLogIdx = WORKFLOW.indexOf('close-protection decision=');
  const autoTransitionIdx = WORKFLOW.indexOf("decision.action === 'auto-transition'");
  expect(decisionLogIdx).toBeGreaterThan(-1);
  expect(autoTransitionIdx).toBeGreaterThan(-1);
  expect(decisionLogIdx).toBeLessThan(autoTransitionIdx);
});

test('#1472 AC4: Epic-role-protection guard appears INSIDE the closed-state cleanup block', () => {
  // Validate that the guard is in the right scope, not outside the if (issue.state === 'closed')
  const closedBlockStart = WORKFLOW.indexOf("issue.state === 'closed' && closeRoles");
  const epicGuardIdx = WORKFLOW.indexOf("isEpic && role === 'role:manager'");
  expect(closedBlockStart).toBeGreaterThan(-1);
  expect(epicGuardIdx).toBeGreaterThan(closedBlockStart);
});

test('#1596 AC3: auto-transition removeLabel uses try/catch + core.setFailed (not silent catch)', () => {
  // Locate the auto-transition block and verify no .catch(() => {}) on the removeLabel call
  const blockStart = WORKFLOW.indexOf("decision.action === 'auto-transition'");
  const blockEnd = WORKFLOW.indexOf("decision.action === 'reopen'");
  const block = WORKFLOW.slice(blockStart, blockEnd);
  // Must NOT have the silent swallow pattern on removeLabel
  expect(block).not.toMatch(/removeLabel\([^)]+\)\.catch/);
  // Must have explicit try/catch with core.setFailed for removeLabel
  expect(block).toMatch(/try\s*\{[\s\S]*?removeLabel/);
  expect(block).toContain('core.setFailed');
  expect(block).toContain('#1596');
});

test('#1596 AC4: auto-transition addLabels uses try/catch + core.setFailed (not silent catch)', () => {
  const blockStart = WORKFLOW.indexOf("decision.action === 'auto-transition'");
  const blockEnd = WORKFLOW.indexOf("decision.action === 'reopen'");
  const block = WORKFLOW.slice(blockStart, blockEnd);
  // Must NOT have .catch(() => {}) on the addLabels call
  expect(block).not.toMatch(/addLabels\([^)]+\)\.catch/);
  // Must have explicit try/catch wrapping addLabels
  expect(block).toMatch(/try\s*\{[\s\S]*?addLabels/);
});
