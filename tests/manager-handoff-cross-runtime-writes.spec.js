'use strict';
// tests/manager-handoff-cross-runtime-writes.spec.js
// AC #2911: cross_runtime_writes hard-blocking gate promotion.
// Uses node:test + node:assert (repo convention — NOT @playwright/test).
const test = require('node:test');
const assert = require('node:assert');
const { checkCrossRuntimeWrites, DEFAULT_CROSS_RUNTIME_PATHS } = require(
  '../scripts/global/megalint/manager-handoff'
);

const PATHS = DEFAULT_CROSS_RUNTIME_PATHS;

// Minimal valid HANDOFF body with a populated cross_runtime_writes field.
const VALID_BODY =
  'MANAGER_HANDOFF\n' +
  'scope: add hook\n' +
  'cross_runtime_writes: .claude/settings.json\n' +
  'target_team_sign_off: https://github.com/org/repo/issues/1#issuecomment-999\n';

// ── Scope-correctness: gate must NOT fire on unrelated PRs ─────────────────

test('no cross-runtime files → gate is silent (scope-correct)', () => {
  const result = checkCrossRuntimeWrites(
    'MANAGER_HANDOFF\nscope: fix linting\n',
    ['scripts/global/foo.js', 'tests/foo.spec.js'],
    PATHS
  );
  assert.deepStrictEqual(result, []);
});

test('empty diffFiles array → gate is silent (no cross-runtime paths touched)', () => {
  const result = checkCrossRuntimeWrites(
    'MANAGER_HANDOFF\nscope: fix linting\n',
    [],
    PATHS
  );
  assert.deepStrictEqual(result, []);
});

// ── MUTATION GUARD: field was advisory, now MUST be hard-blocking ──────────
// These two tests would FAIL if someone reverts the gate to advisory mode.

test('MUTATION: cross-runtime file + missing field → severity is hard (not advisory)', () => {
  const result = checkCrossRuntimeWrites(
    'MANAGER_HANDOFF\nscope: update claude settings\n',
    ['.claude/settings.json'],
    PATHS
  );
  assert.strictEqual(result.length, 1);
  assert.strictEqual(result[0].rule, 'cross-runtime-writes-missing');
  // MUTATION GUARD: must be 'hard', not 'advisory' or absent
  assert.strictEqual(result[0].severity, 'hard',
    'gate must block (severity: hard) — was advisory before #2911 promotion');
});

test('MUTATION: pending sign-off → severity is hard (not advisory)', () => {
  const body =
    'MANAGER_HANDOFF\nscope: write codex config\n' +
    'cross_runtime_writes: .codex/config.json\n' +
    'target_team_sign_off: pending\n';
  const result = checkCrossRuntimeWrites(body, ['.codex/config.json'], PATHS);
  assert.strictEqual(result.length, 1);
  assert.strictEqual(result[0].rule, 'cross-runtime-writes-sign-off-pending');
  assert.strictEqual(result[0].severity, 'hard',
    'pending sign-off must block (severity: hard) — was advisory before #2911 promotion');
});

// ── Hard-blocking cases ────────────────────────────────────────────────────

test('.claude/ path + field absent → cross-runtime-writes-missing (hard)', () => {
  const result = checkCrossRuntimeWrites(
    'MANAGER_HANDOFF\nscope: update claude settings\n',
    ['.claude/settings.json'],
    PATHS
  );
  assert.strictEqual(result.length, 1);
  assert.strictEqual(result[0].rule, 'cross-runtime-writes-missing');
  assert.strictEqual(result[0].severity, 'hard');
  assert.ok(result[0].detail.includes('#2911'));
});

test('.codex/ path + field absent → cross-runtime-writes-missing (hard)', () => {
  const result = checkCrossRuntimeWrites(
    'MANAGER_HANDOFF\nscope: update codex config\n',
    ['.codex/instructions.md'],
    PATHS
  );
  assert.strictEqual(result.length, 1);
  assert.strictEqual(result[0].rule, 'cross-runtime-writes-missing');
  assert.strictEqual(result[0].severity, 'hard');
});

test('.copilot/ path + field absent → cross-runtime-writes-missing (hard)', () => {
  const result = checkCrossRuntimeWrites(
    'MANAGER_HANDOFF\nscope: update copilot config\n',
    ['.copilot/settings.json'],
    PATHS
  );
  assert.strictEqual(result.length, 1);
  assert.strictEqual(result[0].rule, 'cross-runtime-writes-missing');
  assert.strictEqual(result[0].severity, 'hard');
});

// ── MUTATION GUARD: scope-correct path matching (over-broad fix #2911) ───────
// The old code used normalized.includes('/' + prefix) which is over-broad:
// src/x/.claude/y contains '/.claude/' as a substring and would wrongly trigger
// the gate, blocking unrelated PRs. The fix uses startsWith(prefix) only —
// only paths whose FIRST segment IS the cross-runtime root trigger the gate.

test('MUTATION: src/x/.claude/y is NOT matched — over-broad includes() fix', () => {
  // This path has .claude/ nested inside a source subtree, not at repo root.
  // It must NOT trigger the cross_runtime_writes gate. Refs #2911.
  const result = checkCrossRuntimeWrites(
    'MANAGER_HANDOFF\nscope: add source feature\n',
    ['src/x/.claude/y'],
    PATHS
  );
  assert.deepStrictEqual(result, [],
    'src/x/.claude/y must not trigger gate — .claude/ is not at repo root');
});

test('MUTATION: top-level .claude/something IS matched — startsWith check', () => {
  // Confirm the corrected rule still catches the true cross-runtime case.
  const result = checkCrossRuntimeWrites(
    'MANAGER_HANDOFF\nscope: update claude settings\n',
    ['.claude/settings.json'],
    PATHS
  );
  assert.strictEqual(result.length, 1,
    '.claude/settings.json must trigger gate — it is a top-level cross-runtime path');
  assert.strictEqual(result[0].rule, 'cross-runtime-writes-missing');
  assert.strictEqual(result[0].severity, 'hard');
});

test('repo-prefixed .claude/ path → NOT triggered (first segment is repo/, not .claude/)', () => {
  // 'repo/.claude/agents/my-agent.md' does not start with '.claude/'.
  // Under the scope-correct rule, only the root-level cross-runtime directories
  // trigger the gate. A worktree/monorepo sub-path is NOT a cross-runtime write.
  const result = checkCrossRuntimeWrites(
    'MANAGER_HANDOFF\nscope: add agent\n',
    ['repo/.claude/agents/my-agent.md'],
    PATHS
  );
  assert.deepStrictEqual(result, [],
    'repo/.claude/... must not trigger gate — first segment is repo/, not .claude/');
});

// ── Empty / blank field values → cross-runtime-writes-empty (hard) ────────

test('field present but empty string → cross-runtime-writes-empty (hard)', () => {
  const result = checkCrossRuntimeWrites(
    'MANAGER_HANDOFF\nscope: update claude settings\ncross_runtime_writes: \n',
    ['.claude/settings.json'],
    PATHS
  );
  assert.strictEqual(result.length, 1);
  assert.strictEqual(result[0].rule, 'cross-runtime-writes-empty');
  assert.strictEqual(result[0].severity, 'hard');
});

test('field present but "[]" → cross-runtime-writes-empty (hard)', () => {
  const result = checkCrossRuntimeWrites(
    'MANAGER_HANDOFF\nscope: update claude settings\ncross_runtime_writes: []\n',
    ['.claude/settings.json'],
    PATHS
  );
  assert.strictEqual(result.length, 1);
  assert.strictEqual(result[0].rule, 'cross-runtime-writes-empty');
  assert.strictEqual(result[0].severity, 'hard');
});

test('field present but "none" → cross-runtime-writes-empty (hard)', () => {
  const result = checkCrossRuntimeWrites(
    'MANAGER_HANDOFF\nscope: update claude settings\ncross_runtime_writes: none\n',
    ['.claude/settings.json'],
    PATHS
  );
  assert.strictEqual(result.length, 1);
  assert.strictEqual(result[0].rule, 'cross-runtime-writes-empty');
  assert.strictEqual(result[0].severity, 'hard');
});

test('field present but "n/a" (lowercase) → cross-runtime-writes-empty (hard)', () => {
  const result = checkCrossRuntimeWrites(
    'MANAGER_HANDOFF\nscope: update claude settings\ncross_runtime_writes: n/a\n',
    ['.claude/settings.json'],
    PATHS
  );
  assert.strictEqual(result.length, 1);
  assert.strictEqual(result[0].rule, 'cross-runtime-writes-empty');
  assert.strictEqual(result[0].severity, 'hard');
});

test('field present but "N/A" (uppercase) → cross-runtime-writes-empty (hard)', () => {
  const result = checkCrossRuntimeWrites(
    'MANAGER_HANDOFF\nscope: update claude settings\ncross_runtime_writes: N/A\n',
    ['.claude/settings.json'],
    PATHS
  );
  assert.strictEqual(result.length, 1);
  assert.strictEqual(result[0].rule, 'cross-runtime-writes-empty');
  assert.strictEqual(result[0].severity, 'hard');
});

test('field present but "None" (mixed case) → cross-runtime-writes-empty (hard)', () => {
  const result = checkCrossRuntimeWrites(
    'MANAGER_HANDOFF\nscope: update claude settings\ncross_runtime_writes: None\n',
    ['.claude/settings.json'],
    PATHS
  );
  assert.strictEqual(result.length, 1);
  assert.strictEqual(result[0].rule, 'cross-runtime-writes-empty');
  assert.strictEqual(result[0].severity, 'hard');
});

// ── Pending sign-off → cross-runtime-writes-sign-off-pending (hard) ───────

test('target_team_sign_off: pending → hard block', () => {
  const body =
    'MANAGER_HANDOFF\nscope: write codex config\n' +
    'cross_runtime_writes: .codex/config.json\n' +
    'target_team_sign_off: pending\n';
  const result = checkCrossRuntimeWrites(body, ['.codex/config.json'], PATHS);
  assert.strictEqual(result.length, 1);
  assert.strictEqual(result[0].rule, 'cross-runtime-writes-sign-off-pending');
  assert.strictEqual(result[0].severity, 'hard');
  assert.ok(result[0].detail.includes('TEAM_RESPONSE'));
});

// ── Happy-path: field populated + sign-off present → no violations ─────────

test('cross-runtime file + field populated + sign-off URL → no violations', () => {
  const result = checkCrossRuntimeWrites(VALID_BODY, ['.claude/settings.json'], PATHS);
  assert.deepStrictEqual(result, []);
});

test('multiple cross-runtime files + valid field → no violations', () => {
  const body =
    'MANAGER_HANDOFF\nscope: update both configs\n' +
    'cross_runtime_writes: .claude/settings.json, .codex/config.json\n' +
    'target_team_sign_off: https://github.com/org/repo/issues/1#issuecomment-999\n';
  const result = checkCrossRuntimeWrites(
    body,
    ['.claude/settings.json', '.codex/config.json'],
    PATHS
  );
  assert.deepStrictEqual(result, []);
});

// ── Fail-closed: diffFiles null/undefined with declared field ──────────────

test('diffFiles=null but field declared → validates field (fail-closed path)', () => {
  // When diffFiles is null the function falls back to checking if the author
  // declared cross_runtime_writes. If declared, it still validates it.
  const body =
    'MANAGER_HANDOFF\nscope: write codex config\n' +
    'cross_runtime_writes: \n'; // empty — should flag
  const result = checkCrossRuntimeWrites(body, null, PATHS);
  assert.strictEqual(result.length, 1);
  assert.strictEqual(result[0].rule, 'cross-runtime-writes-empty');
  assert.strictEqual(result[0].severity, 'hard');
});

test('diffFiles=null + field absent + no claim → silent (scope unknown, not a blocking gate)', () => {
  // Cannot determine scope when diffFiles is null AND author made no claim.
  // Gate defers to PR review — scope-correct, does not over-block.
  const result = checkCrossRuntimeWrites(
    'MANAGER_HANDOFF\nscope: fix linting\n',
    null,
    PATHS
  );
  assert.deepStrictEqual(result, []);
});

// ── Configurable paths (AC: path list configurable via governance-rules.yaml) ─

test('custom crossPaths override is respected', () => {
  const customPaths = ['.custom-runtime/'];
  const result = checkCrossRuntimeWrites(
    'MANAGER_HANDOFF\nscope: update custom config\n',
    ['.custom-runtime/config.json'],
    customPaths
  );
  assert.strictEqual(result.length, 1);
  assert.strictEqual(result[0].rule, 'cross-runtime-writes-missing');
});

test('default paths do NOT fire on unrelated custom paths', () => {
  const result = checkCrossRuntimeWrites(
    'MANAGER_HANDOFF\nscope: update custom config\n',
    ['.custom-runtime/config.json'],
    PATHS // default paths: .claude/, .codex/, .copilot/
  );
  assert.deepStrictEqual(result, []);
});
