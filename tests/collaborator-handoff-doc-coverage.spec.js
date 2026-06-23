// Refs #2424 - tests for doc-coverage block blocking gate (upgraded from advisory)
const test = require('node:test');
const assert = require('node:assert/strict');
const { validate } = require('../scripts/global/megalint/collaborator-handoff.js');
const { checkBlock, parseDocBlock, loadMatrix } = require('../scripts/global/megalint/doc-coverage.js');

const VERIFICATION_BLOCK = 'Pre-handoff verification (PASS)\n- [x] `branch-name-prefix` — pass\n';
const HANDOFF_SIGNED = (extra) =>
  `## COLLABORATOR_HANDOFF\n${extra}\n${VERIFICATION_BLOCK}worktree_branch: feat/test\nworktree_behind_main: 0\ncross_family_reviewer: qwen2.5-coder:32b@100.91.113.16:11434\ncross_family_rating: 82/100\ncross_family_findings: none\ncross_family_receipt: 0123456789abcdef\nreviewer_family: Qwen\nSigned-by: Alex Harper\nTeam&Model: copilot:sonnet@anthropic\nRole: collaborator\n`;

test('validate: blocking when doc-coverage: block missing on lane:code-change with governance label', () => {
  const matrix = loadMatrix();
  const body = HANDOFF_SIGNED('no doc block here');
  const result = validate({
    lane: 'lane:code-change', labels: ['area:governance'],
    comments: [{ body, user: { login: 'alex' } }],
  });
  assert.equal(result.ok, false);
  assert.ok(result.violations.some(v => v.rule === 'doc-coverage-missing'), JSON.stringify(result.violations));
});

test('validate: passes when doc-coverage: block has required surfaces', () => {
  const body = HANDOFF_SIGNED(
    'doc-coverage:\n  .changes/unreleased/: DONE — #2424.md\n  docs/workflow/learnings.md: N/A — no-user-visible-change\n  governance/README.md: DONE\n  docs/howto/baton-workflow.md: DONE\n  wiki/wisdom/global/concepts/: N/A — no-user-visible-change\n'
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

test('validate: removed DOC_COVERAGE_GATE_ADVISORY env var no longer bypasses the gate', () => {
  // #2712 removed the advisory escape hatch; #3016 confirms the env var is inert and
  // the gate still blocks. The sanctioned bypass is now LEGACY_DOC_SKIP + a BLOCKER_NOTE.
  process.env.DOC_COVERAGE_GATE_ADVISORY = '1';
  const result = validate({
    lane: 'lane:code-change', labels: ['area:governance'],
    comments: [{ body: HANDOFF_SIGNED('no block'), user: { login: 'alex' } }],
  });
  delete process.env.DOC_COVERAGE_GATE_ADVISORY;
  assert.equal(result.ok, false);
  assert.ok(result.violations.some(v => v.rule === 'doc-coverage-missing'));
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
  assert.ok(violations.some(v => v.rule === 'doc-coverage-missing'));
});

test('checkBlock: bare N/A without reason is blocking', () => {
  const matrix = loadMatrix();
  const violations = checkBlock('doc-coverage:\n  .changes/unreleased/: N/A\n', ['area:governance'], matrix);
  assert.ok(violations.some(v => v.rule === 'doc-coverage-missing'));
});

test('checkBlock: passes when no required surfaces for given labels', () => {
  const matrix = loadMatrix();
  const violations = checkBlock('', [], matrix);
  assert.equal(violations.length, 0);
});
