// tests/test-floor-classifier.spec.js — Epic #1948 Phase-1 re-ship (#3098).
// Strategy: tdd-pyramid (surface→floor + declared-vs-derived reconcile units).
// Stress/fault-injection + p99-budget coverage: tests/stress-test-floor-classifier.spec.js.
'use strict';

const { test, expect } = require('@playwright/test');
const tfc = require('../scripts/global/test-floor-classifier');

// ── surfaceForPath ──

test('surfaceForPath maps each matrix surface to its floor', () => {
  const cases = [
    ['.github/workflows/ci.yml', 'ci-workflow', 'golden-file'],
    ['cloudflare/worker/route.ts', 'worker-route', 'contract-test'],
    ['dashboard/js/panel.js', 'dashboard-ui', 'visual-regression'],
    ['hooks/scripts/pretool_guard.py', 'python-hook', 'tdd-pyramid'],
    ['skills/foo/SKILL.md', 'llm-agent', 'eval-harness'],
    ['agents/architect.agent.md', 'llm-agent', 'eval-harness'],
    ['research/x-2026.md', 'research-adr', 'peer-review'],
    ['instructions/y.instructions.md', 'docs', 'drift-lint'],
    ['scripts/global/foo.js', 'governance-script', 'tdd-pyramid'],
    ['tests/foo.spec.js', 'test', 'none'],
  ];
  for (const [pathStr, surface, floor] of cases) {
    const got = tfc.surfaceForPath(pathStr);
    expect(got, `no surface for ${pathStr}`).toBeTruthy();
    expect(got.surface, pathStr).toBe(surface);
    expect(got.floor, pathStr).toBe(floor);
  }
});

test('surfaceForPath normalizes ./ and leading-slash prefixes', () => {
  expect(tfc.surfaceForPath('./scripts/global/x.js').surface).toBe('governance-script');
  expect(tfc.surfaceForPath('/instructions/x.md').surface).toBe('docs');
});

test('surfaceForPath returns null for an unmapped path', () => {
  expect(tfc.surfaceForPath('random/unmapped.txt')).toBeNull();
});

// ── deriveFloor + stress derivation ──

test('deriveFloor flags stress for path-identifiable concurrency/gate surfaces', () => {
  const out = tfc.deriveFloor(['scripts/global/worktree-lease.js', 'scripts/global/merge-gate.js']);
  expect(out.stressRequired).toBe(true);
  expect(out.codeFloors).toContain('tdd-pyramid');
});

test('deriveFloor does not require stress for a plain non-triggering script', () => {
  const out = tfc.deriveFloor(['scripts/global/plain-helper.js']);
  expect(out.stressRequired).toBe(false);
  expect(out.codeFloors).toEqual(['tdd-pyramid']);
});

test('deriveFloor ignores docs/test floors as code-floor constraints', () => {
  const out = tfc.deriveFloor(['docs/howto/x.md', 'tests/y.spec.js']);
  expect(out.codeFloors).toEqual([]);
  expect(out.stressRequired).toBe(false);
});

// ── reconcile (the #1948 declared-vs-derived core) ──

test('reconcile catches the #1682 case: state-mutating gate declared without stress', () => {
  const r = tfc.reconcile('tdd-pyramid', ['scripts/global/cross-team-lease-gate.js']);
  expect(r.meetsFloor).toBe(false);
  expect(r.gaps.join(' ')).toMatch(/stress-test required/);
});

test('reconcile passes when stress is declared for a stress surface', () => {
  expect(tfc.reconcile('tdd-pyramid+stress-test', ['scripts/global/worktree-gate.js']).meetsFloor).toBe(true);
});

test('reconcile flags a below-floor declaration (none/manual-verify) on real code', () => {
  expect(tfc.reconcile('none', ['scripts/global/foo.js']).gaps.join(' ')).toMatch(/below the code floor/);
  expect(tfc.reconcile('manual-verify', ['scripts/global/foo.js']).meetsFloor).toBe(false);
});

test('reconcile passes a docs-only change declared drift-lint', () => {
  expect(tfc.reconcile('drift-lint', ['instructions/x.md']).meetsFloor).toBe(true);
});

test('reconcile flags an invalid declared enum value', () => {
  expect(tfc.reconcile('made-up-strategy', ['scripts/global/foo.js']).gaps.join(' ')).toMatch(/not a valid enum/);
});

test('parseDeclared splits primary + stress and validates', () => {
  expect(tfc.parseDeclared('tdd-pyramid+stress-test')).toMatchObject({ primary: 'tdd-pyramid', stress: true, valid: true });
  expect(tfc.parseDeclared('golden-file')).toMatchObject({ primary: 'golden-file', stress: false, valid: true });
  expect(tfc.parseDeclared('bogus').valid).toBe(false);
});
