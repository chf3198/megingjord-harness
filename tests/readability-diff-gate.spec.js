'use strict';

// tdd-pyramid unit tests for the diff-aware readability gate (#1434).
// Covers: net-new detection, baseline-drift ignored, new-file handling,
// path filtering, and base-ref resolution / missing-base fallback.

const test = require('node:test');
const assert = require('node:assert/strict');
const { execFileSync } = require('node:child_process');
const path = require('node:path');

const {
  checkContent,
  isScannedJs,
  sumNetNew,
  resolveBaseRef,
  verifyRef,
} = require('../scripts/global/lint-readability-core');

const CLI = path.resolve(__dirname, '..', 'scripts', 'lint-readability.js');

test('checkContent flags single-letter vars, magic numbers, and long functions', () => {
  const single = checkContent('const x = 1;\n', 'scripts/sample.js');
  assert.equal(single.some(w => w.rule === 'naming'), true);

  const magic = checkContent('const total = items + 256;\n', 'scripts/sample.js');
  assert.equal(magic.some(w => w.rule === 'magic-number'), true);

  const clean = checkContent('const itemCount = items + 100;\n', 'scripts/sample.js');
  assert.equal(clean.length, 0, 'descriptive name + allowed number is clean');
});

test('isScannedJs includes scripts/ and dashboard/js, excludes specs and other paths', () => {
  assert.equal(isScannedJs('scripts/global/foo.js'), true);
  assert.equal(isScannedJs('dashboard/js/app.js'), true);
  assert.equal(isScannedJs('tests/foo.spec.js'), false);
  assert.equal(isScannedJs('scripts/global/lint-readability-core.js'), false, 'self-excluded');
  assert.equal(isScannedJs('docs/foo.js'), false);
  assert.equal(isScannedJs('scripts/foo.md'), false);
});

test('sumNetNew counts only positive per-file deltas (new regressions)', () => {
  const result = sumNetNew([{ file: 'scripts/a.js', current: 5, base: 3 }]);
  assert.equal(result.netNew, 2);
  assert.equal(result.regressions.length, 1);
  assert.equal(result.regressions[0].delta, 2);
});

test('sumNetNew ignores pre-existing baseline drift (delta <= 0)', () => {
  // file is unchanged in warning count, or improved — must NOT fail the gate
  const unchanged = sumNetNew([{ file: 'scripts/a.js', current: 9, base: 9 }]);
  assert.equal(unchanged.netNew, 0);
  const improved = sumNetNew([{ file: 'scripts/a.js', current: 4, base: 7 }]);
  assert.equal(improved.netNew, 0);
  assert.equal(improved.regressions.length, 0);
});

test('sumNetNew treats a new file (base 0) as fully net-new', () => {
  const result = sumNetNew([{ file: 'scripts/new.js', current: 3, base: 0 }]);
  assert.equal(result.netNew, 3);
});

test('sumNetNew does not let an improvement mask a regression elsewhere', () => {
  const result = sumNetNew([
    { file: 'scripts/improved.js', current: 1, base: 5 },
    { file: 'scripts/regressed.js', current: 4, base: 2 },
  ]);
  assert.equal(result.netNew, 2, 'only the +2 regression counts; -4 improvement does not offset');
});

test('resolveBaseRef returns null for an unverifiable base (missing-base fallback)', () => {
  assert.equal(verifyRef('definitely-not-a-real-ref-1434'), false);
  assert.equal(resolveBaseRef('definitely-not-a-real-ref-1434'), null);
});

test('resolveBaseRef resolves a real ref (HEAD always exists in a checkout)', () => {
  assert.equal(resolveBaseRef('HEAD'), 'HEAD');
});

test('CLI --changed-only --json emits a parseable changed-only report', () => {
  const out = execFileSync('node', [CLI, '--changed-only=HEAD', '--json'], { encoding: 'utf8' });
  const parsed = JSON.parse(out.trim().split('\n').pop());
  assert.equal(parsed.mode, 'changed-only');
  assert.equal(typeof parsed.netNew, 'number');
});

test('CLI falls back to absolute mode when the base ref is unavailable', () => {
  const out = execFileSync('node',
    [CLI, '--changed-only=no-such-ref-xyz', '--max-warnings=100000', '--json'],
    { encoding: 'utf8' });
  const parsed = JSON.parse(out.trim().split('\n').pop());
  assert.equal(parsed.mode, 'absolute', 'unavailable base degrades to the absolute gate');
});

// Integration: exercise computeRegressions over REAL git history (#1434, AC1/AC3 end-to-end).
// Addresses the cross-family (qwen-32b) finding that only the pure sumNetNew helper and the
// CLI fallback path were covered — never the gitChangedPaths/baseWarningCount git layer against
// a real base revision. Builds a throwaway repo and injects it as `root`.
test('computeRegressions detects net-new over real git history, ignores baseline drift', () => {
  const fs2 = require('node:fs');
  const os = require('node:os');
  const { computeRegressions } = require('../scripts/global/lint-readability-core');
  const git = (repo, args) => execFileSync('git', args, { cwd: repo, encoding: 'utf8' });

  const repo = fs2.mkdtempSync(path.join(os.tmpdir(), 'rd-gate-'));
  try {
    git(repo, ['init', '-q']);
    git(repo, ['config', 'user.email', 'gate@test.local']);
    git(repo, ['config', 'user.name', 'gate-test']);
    fs2.mkdirSync(path.join(repo, 'scripts'), { recursive: true });
    // base commit: clean.js (0 warnings), drift.js (1 pre-existing warning)
    fs2.writeFileSync(path.join(repo, 'scripts', 'clean.js'), 'const itemCount = 1;\n');
    fs2.writeFileSync(path.join(repo, 'scripts', 'drift.js'), 'const y = 2;\n');
    git(repo, ['add', '-A']);
    git(repo, ['commit', '-q', '-m', 'base']);
    const base = git(repo, ['rev-parse', 'HEAD']).trim();
    // HEAD commit: clean.js gains a net-new warning; drift.js touched but warning count unchanged;
    // new.js is brand-new with a warning (base absent -> baseline 0).
    fs2.writeFileSync(path.join(repo, 'scripts', 'clean.js'), 'const x = 1;\n');
    fs2.writeFileSync(path.join(repo, 'scripts', 'drift.js'), 'const y = 2;\n// touched, still one warning\n');
    fs2.writeFileSync(path.join(repo, 'scripts', 'new.js'), 'const z = 3;\n');
    git(repo, ['add', '-A']);
    git(repo, ['commit', '-q', '-m', 'head']);

    const { netNew, regressions } = computeRegressions(base, repo);
    assert.equal(netNew, 2, 'clean.js (+1) and new.js (+1) are net-new; drift.js (+0) is ignored');
    const files = regressions.map(r => r.file).sort();
    assert.deepEqual(files, ['scripts/clean.js', 'scripts/new.js']);
    assert.equal(regressions.some(r => r.file === 'scripts/drift.js'), false,
      'pre-existing baseline drift must not be flagged');
  } finally {
    fs2.rmSync(repo, { recursive: true, force: true });
  }
});

test('resolveBaseRef honours an injected root (origin/main|main candidates resolved per-repo)', () => {
  const fs2 = require('node:fs');
  const os = require('node:os');
  const { resolveBaseRef } = require('../scripts/global/lint-readability-core');
  const git = (repo, args) => execFileSync('git', args, { cwd: repo, encoding: 'utf8' });
  const repo = fs2.mkdtempSync(path.join(os.tmpdir(), 'rd-base-'));
  try {
    git(repo, ['init', '-q', '-b', 'main']);
    git(repo, ['config', 'user.email', 'gate@test.local']);
    git(repo, ['config', 'user.name', 'gate-test']);
    fs2.writeFileSync(path.join(repo, 'f.txt'), 'x\n');
    git(repo, ['add', '-A']);
    git(repo, ['commit', '-q', '-m', 'init']);
    assert.equal(resolveBaseRef(null, repo), 'main', 'falls through candidates to local main');
    assert.equal(resolveBaseRef('no-such-ref', repo), null, 'unverifiable explicit base -> null');
  } finally {
    fs2.rmSync(repo, { recursive: true, force: true });
  }
});

test('checkNaming does not flag GitHub ticket refs in comments or hyphenated identifiers (#3470)', () => {
  const inlineRef = checkContent('const enabled = true; // #3428 Epic #3425 P1-a\n', 'scripts/s.js');
  assert.equal(inlineRef.some(w => w.rule === 'magic-number'), false, 'inline // #N ref is not a magic number');

  const fullLineRef = checkContent('// Refs #3428 tracks this\nconst enabled = true;\n', 'scripts/s.js');
  assert.equal(fullLineRef.some(w => w.rule === 'magic-number'), false, 'full-line // ref clean');

  const quotedId = checkContent("const patternId = 'F6-3424-worktree-residual';\n", 'scripts/s.js');
  assert.equal(quotedId.some(w => w.rule === 'magic-number'), false, 'hyphenated quoted identifier clean');

  const wordAdjacent = checkContent('const ref = ticket3424;\n', 'scripts/s.js');
  assert.equal(wordAdjacent.some(w => w.rule === 'magic-number'), false, 'word-adjacent digit run clean');

  // anti-over-suppress: a genuine STANDALONE magic number MUST still flag.
  const genuine = checkContent('const timeout = 5000;\n', 'scripts/s.js');
  assert.equal(genuine.some(w => w.rule === 'magic-number'), true, 'genuine magic number still flagged');

  // panel edge case: punctuation-adjacent standalone literal still flags.
  const punct = checkContent('callWith(5000, base);\n', 'scripts/s.js');
  assert.equal(punct.some(w => w.rule === 'magic-number'), true, 'paren/comma-adjacent literal still flagged');

  // panel edge case: a `//` INSIDE a string literal must not truncate a later magic number.
  const urlThenMagic = checkContent("const url = 'https://h'; const httpTimeout = 6000;\n", 'scripts/s.js');
  assert.equal(urlThenMagic.some(w => w.rule === 'magic-number'), true, 'string // does not hide a later magic number');
});
