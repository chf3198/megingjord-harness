// Refs #2424 - tests for doc-coverage block blocking gate (upgraded from advisory)
const test = require('node:test');
const assert = require('node:assert/strict');
const { validate } = require('../scripts/global/megalint/collaborator-handoff.js');
const { checkBlock, parseDocBlock, loadMatrix } = require('../scripts/global/megalint/doc-coverage.js');

const HANDOFF_SIGNED = (extra) =>
  `## COLLABORATOR_HANDOFF\n${extra}\nSigned-by: Alex Harper\nTeam&Model: copilot:sonnet@anthropic\nRole: collaborator\n`;

test('validate: blocking when doc-coverage: block missing on lane:code-change with governance label', () => {
  const matrix = loadMatrix();
  const body = HANDOFF_SIGNED('no doc block here');
  const result = validate({
    lane: 'lane:code-change', labels: ['area:governance'],
    comments: [{ body, user: { login: 'alex' } }],
  });
  assert.equal(result.ok, false);
  assert.ok(result.violations.some(v => v.rule === 'doc-coverage-missing-block'), JSON.stringify(result.violations));
});

test('validate: passes when doc-coverage: block has required surfaces', () => {
  const body = HANDOFF_SIGNED(
    'doc-coverage:\n  .changes/unreleased/: DONE — #2424.md\n  docs/workflow/learnings.md: N/A — no new pattern\n  governance/README.md: DONE\n  docs/howto/baton-workflow.md: DONE\n'
  );
  const result = validate({
    lane: 'lane:code-change', labels: ['area:governance'],
    comments: [{ body, user: { login: 'alex' } }],
  });
  assert.equal(result.ok, true, JSON.stringify(result.violations));
});

test('validate: skips doc-coverage check on lightweight lanes', () => {
  const result = validate({
    lane: 'lane:docs-research', labels: ['area:governance'],
    comments: [{ body: HANDOFF_SIGNED(''), user: { login: 'alex' } }],
  });
  assert.equal(result.ok, true);
});

test('validate: advisory mode env var bypasses blocking', () => {
  process.env.DOC_COVERAGE_GATE_ADVISORY = '1';
  const result = validate({
    lane: 'lane:code-change', labels: ['area:governance'],
    comments: [{ body: HANDOFF_SIGNED('no block'), user: { login: 'alex' } }],
  });
  delete process.env.DOC_COVERAGE_GATE_ADVISORY;
  assert.equal(result.ok, true);
});

test('parseDocBlock: returns null when no doc-coverage: header', () => {
  assert.equal(parseDocBlock('no block here'), null);
});

test('parseDocBlock: parses entries from indented block', () => {
  const body = 'doc-coverage:\n  .changes/unreleased/: DONE\n  README.md: N/A\n';
  const block = parseDocBlock(body);
  assert.ok(block);
  assert.equal(block['.changes/unreleased/'], 'DONE');
  assert.equal(block['README.md'], 'N/A');
});

test('checkBlock: returns violation for missing required surface', () => {
  const matrix = loadMatrix();
  const violations = checkBlock('doc-coverage:\n  README.md: DONE\n', ['area:governance'], matrix);
  assert.ok(violations.some(v => v.rule === 'doc-coverage-surface-missing'));
});

test('checkBlock: passes when no required surfaces for given labels', () => {
  const matrix = loadMatrix();
  const violations = checkBlock('', [], matrix);
  assert.equal(violations.length, 0);
});
