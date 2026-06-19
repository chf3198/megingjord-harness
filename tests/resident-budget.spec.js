'use strict';
const { test } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const {
  computeBudget,
  pointerViolations,
  residentRepoFiles,
} = require('../scripts/global/resident-budget.js');

test('residentRepoFiles includes CLAUDE.md and instructions', () => {
  const files = residentRepoFiles();
  assert.ok(files.length >= 1, 'finds at least CLAUDE.md');
  assert.ok(
    files.some((file) => file.endsWith('CLAUDE.md')),
    'includes CLAUDE.md'
  );
});

test('computeBudget reports tokens, baseline and target', () => {
  const report = computeBudget([]);
  assert.ok(report.tokens > 0, 'positive token estimate');
  assert.equal(report.baseline_tokens, 59000);
  assert.equal(report.target_tokens, 30000);
  assert.equal(typeof report.over_target, 'boolean');
});

test('pointerViolations flags index lines over the 200-char budget', () => {
  const tmp = path.join(os.tmpdir(), `mem-${process.pid}.md`);
  fs.writeFileSync(tmp, `- [Short](a.md) — ok\n- [Long](b.md) — ${'x'.repeat(260)}\n## Files\n`);
  const violations = pointerViolations(tmp);
  assert.equal(violations.length, 1, 'one over-budget pointer flagged');
  fs.unlinkSync(tmp);
});

test('pointerViolations is resilient to an absent memory file (G6)', () => {
  assert.deepEqual(pointerViolations(null), []);
  assert.deepEqual(pointerViolations('/nonexistent/MEMORY.md'), []);
});

test('computeBudget measures operator MEMORY.md when a path is provided', () => {
  const tmp = path.join(os.tmpdir(), `mem2-${process.pid}.md`);
  fs.writeFileSync(tmp, '- [X](x.md) — hook\n');
  const withMem = computeBudget(['--memory-path', tmp]);
  assert.ok(withMem.memory_measured, 'measures memory when path given');
  const without = computeBudget([]);
  assert.equal(without.memory_measured, false, 'repo-only when no path');
  fs.unlinkSync(tmp);
});
