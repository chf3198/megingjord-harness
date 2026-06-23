'use strict';
// tests/cross-runtime-writes-gate.spec.js — AC #2911: cross_runtime_writes hard CI gate.
// Validates that MANAGER_HANDOFF blocks when PR diff touches cross-runtime paths without
// declaring cross_runtime_writes, and that CONSULTANT_CLOSEOUT blocks when sign-off is pending.
// Refs #2911 (Rule 1.9 advisory → hard-blocking).

const test = require('node:test');
const assert = require('node:assert');
const {
  checkCrossRuntimeWrites,
  CROSS_RUNTIME_PATHS,
  validate,
} = require('../scripts/global/megalint/manager-handoff.js');
const {
  checkCrossRuntimeWritesPending,
} = require('../scripts/global/megalint/consultant-closeout.js');

// ── CROSS_RUNTIME_PATHS constant ────────────────────────────────────────────

test('CROSS_RUNTIME_PATHS is a non-empty array of strings', () => {
  assert.ok(Array.isArray(CROSS_RUNTIME_PATHS));
  assert.ok(CROSS_RUNTIME_PATHS.length > 0);
  for (const p of CROSS_RUNTIME_PATHS) assert.strictEqual(typeof p, 'string');
});

test('CROSS_RUNTIME_PATHS includes .claude/ .codex/ .copilot/ by default', () => {
  assert.ok(CROSS_RUNTIME_PATHS.some(p => p.includes('.claude')));
  assert.ok(CROSS_RUNTIME_PATHS.some(p => p.includes('.codex')));
  assert.ok(CROSS_RUNTIME_PATHS.some(p => p.includes('.copilot')));
});

// ── checkCrossRuntimeWrites — gate is inactive when no cross-runtime paths touched ──

test('no violation when changedPaths is empty', () => {
  assert.deepStrictEqual(checkCrossRuntimeWrites('some body', [], ['.claude/']), []);
});

test('no violation when changedPaths is undefined (fail-open)', () => {
  assert.deepStrictEqual(checkCrossRuntimeWrites('some body', undefined, ['.claude/']), []);
});

test('no violation when changedPaths is null (fail-open)', () => {
  assert.deepStrictEqual(checkCrossRuntimeWrites('some body', null, ['.claude/']), []);
});

test('no violation when changedPaths touches non-cross-runtime paths only', () => {
  const paths = ['src/index.js', 'README.md', 'tests/foo.spec.js'];
  assert.deepStrictEqual(checkCrossRuntimeWrites('some body', paths, ['.claude/', '.codex/']), []);
});

// ── checkCrossRuntimeWrites — gate blocks on cross-runtime path without field ──

const BODY_NO_CRW = `## MANAGER_HANDOFF
scope: add hook
lane: lane:code-change
Signed-by: Cyrus Mason
Team&Model: cursor:composer@cursor-ide
Role: manager`;

const BODY_WITH_CRW = `## MANAGER_HANDOFF
scope: add hook
lane: lane:code-change
cross_runtime_writes: .claude/settings.json
Signed-by: Cyrus Mason
Team&Model: cursor:composer@cursor-ide
Role: manager`;

test('[mutation-anchor] blocks when .claude/ path touched and cross_runtime_writes absent', () => {
  const result = checkCrossRuntimeWrites(BODY_NO_CRW, ['.claude/settings.json'], ['.claude/']);
  assert.strictEqual(result.length, 1);
  assert.strictEqual(result[0].rule, 'cross-runtime-writes-missing');
  assert.strictEqual(result[0].severity, 'hard');
});

test('[mutation-anchor] blocks when .codex/ path touched and cross_runtime_writes absent', () => {
  const result = checkCrossRuntimeWrites(BODY_NO_CRW, ['.codex/config.json'], ['.codex/']);
  assert.strictEqual(result.length, 1);
  assert.strictEqual(result[0].rule, 'cross-runtime-writes-missing');
});

test('[mutation-anchor] blocks when .copilot/ path touched and cross_runtime_writes absent', () => {
  const result = checkCrossRuntimeWrites(BODY_NO_CRW, ['.copilot/instructions.md'], ['.copilot/']);
  assert.strictEqual(result.length, 1);
  assert.strictEqual(result[0].rule, 'cross-runtime-writes-missing');
});

test('no violation when cross_runtime_writes present and paths match', () => {
  const result = checkCrossRuntimeWrites(BODY_WITH_CRW, ['.claude/settings.json'], ['.claude/']);
  assert.deepStrictEqual(result, []);
});

test('violation detail mentions the affected path', () => {
  const result = checkCrossRuntimeWrites(BODY_NO_CRW, ['.claude/hooks/pre-run.sh'], ['.claude/']);
  assert.match(result[0].detail, /\.claude\/hooks\/pre-run\.sh/);
});

test('treats cross_runtime_writes: none as absent (blocks)', () => {
  const body = BODY_NO_CRW + '\ncross_runtime_writes: none';
  const result = checkCrossRuntimeWrites(body, ['.claude/settings.json'], ['.claude/']);
  assert.strictEqual(result.length, 1);
  assert.strictEqual(result[0].rule, 'cross-runtime-writes-missing');
});

test('uses env-configurable configPaths override', () => {
  const customPaths = ['.myruntime/'];
  const result = checkCrossRuntimeWrites(BODY_NO_CRW, ['.myruntime/config.json'], customPaths);
  assert.strictEqual(result.length, 1);
  assert.strictEqual(result[0].rule, 'cross-runtime-writes-missing');
});

// ── validate() integration — checkCrossRuntimeWrites wired in ───────────────

const VALID_MH = `## MANAGER_HANDOFF
scope: add hook
lane: lane:code-change
test_strategy: tdd-pyramid
acceptance: AC1 pass
gates: lint
related_tickets: #1
overlap_decision: no-overlap
Signed-by: Cyrus Mason
Team&Model: cursor:composer@cursor-ide
Role: manager`;

test('validate passes when no cross-runtime paths in changedPaths', () => {
  const result = validate({
    comments: [{ body: VALID_MH }],
    changedPaths: ['src/foo.js'],
  });
  const hits = result.violations.filter(v => v.rule === 'cross-runtime-writes-missing');
  assert.strictEqual(hits.length, 0);
});

test('validate blocks when changedPaths touches .claude/ without cross_runtime_writes', () => {
  const result = validate({
    comments: [{ body: VALID_MH }],
    changedPaths: ['.claude/settings.json'],
  });
  const hits = result.violations.filter(v => v.rule === 'cross-runtime-writes-missing');
  assert.strictEqual(hits.length, 1);
  assert.strictEqual(result.ok, false);
});

test('validate passes when changedPaths omitted (fail-open; backward-compat)', () => {
  const result = validate({ comments: [{ body: VALID_MH }] });
  const hits = result.violations.filter(v => v.rule === 'cross-runtime-writes-missing');
  assert.strictEqual(hits.length, 0);
});

// ── checkCrossRuntimeWritesPending (closeout gate) ───────────────────────────

const MH_WITH_PENDING = `## MANAGER_HANDOFF
scope: write claude settings
lane: lane:config-only
cross_runtime_writes: .claude/settings.json
target_team_sign_off: pending
Signed-by: Cyrus Mason
Team&Model: cursor:composer@cursor-ide
Role: manager`;

const MH_WITH_RESOLVED = `## MANAGER_HANDOFF
scope: write claude settings
lane: lane:config-only
cross_runtime_writes: .claude/settings.json
target_team_sign_off: https://github.com/org/repo/issues/1#issuecomment-123
Signed-by: Cyrus Mason
Team&Model: cursor:composer@cursor-ide
Role: manager`;

const MH_NO_CRW = `## MANAGER_HANDOFF
scope: docs update
lane: lane:docs-research
Signed-by: Cyrus Mason
Team&Model: cursor:composer@cursor-ide
Role: manager`;

test('[mutation-anchor] closeout blocks when cross_runtime_writes has target_team_sign_off: pending', () => {
  const comments = [{ body: MH_WITH_PENDING }];
  const result = checkCrossRuntimeWritesPending(comments);
  assert.strictEqual(result.length, 1);
  assert.strictEqual(result[0].rule, 'cross-runtime-sign-off-pending');
});

test('closeout passes when target_team_sign_off is a URL (resolved)', () => {
  const comments = [{ body: MH_WITH_RESOLVED }];
  assert.deepStrictEqual(checkCrossRuntimeWritesPending(comments), []);
});

test('closeout passes when no cross_runtime_writes field in MANAGER_HANDOFF', () => {
  const comments = [{ body: MH_NO_CRW }];
  assert.deepStrictEqual(checkCrossRuntimeWritesPending(comments), []);
});

test('closeout passes when no MANAGER_HANDOFF comment present', () => {
  assert.deepStrictEqual(checkCrossRuntimeWritesPending([]), []);
});

test('closeout passes when comments is null/undefined', () => {
  assert.deepStrictEqual(checkCrossRuntimeWritesPending(null), []);
  assert.deepStrictEqual(checkCrossRuntimeWritesPending(undefined), []);
});

test('closeout violation detail references #2911', () => {
  const result = checkCrossRuntimeWritesPending([{ body: MH_WITH_PENDING }]);
  assert.match(result[0].detail, /#2911/);
});
