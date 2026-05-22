// Phase-1 C6 stress-test of Epic #2091 — Refs #2107.
// Stress-tests hooks/scripts/canonical_main_enforcer.py against a randomized
// path corpus. Asserts precision ≥99% (target ZERO false-rejections of legitimately-gitignored paths).
const { test, expect } = require('@playwright/test');
const path = require('path');
const os = require('os');
const { spawnSync } = require('child_process');

const REPO_ROOT = path.resolve(__dirname, '..');
const ENFORCER_DIR = path.join(REPO_ROOT, 'hooks', 'scripts');

// Allowlist corpus: paths gitignored AND not tracked, per actual .gitignore.
// Note: `git check-ignore` requires a FILE PATH inside a directory-pattern ancestor
// (e.g. `.log4brains/foo` matches the `.log4brains/` directory pattern), not the
// bare directory name itself. Test fixtures use files inside the ignored ancestors.
const ALLOWED_CORPUS = [
  '.env', '.env.local', '.env.production', '.envrc', '.npmrc',
  'node_modules',
  '.dashboard/state.json',
  'tmp/snapshot.json',
  '.log4brains/state',
  '.worktrees/foo',
  'hooks/state/repo-x.json',
  'logs/copilot-usage.json',
];

// Rejection corpus: tracked files (~5K in this repo).
const TRACKED_CORPUS = [
  'README.md', 'package.json', 'CHANGELOG.md',
  'hooks/scripts/pretool_guard.py',
  'hooks/scripts/canonical_main_enforcer.py',
  'instructions/global-standards.instructions.md',
  'scripts/global/agent-signature.js',
  '.github/workflows/baton-gates.yml',
  'wiki/index.md',
];

function evaluatePath(p) {
  const driver = `import sys; sys.path.insert(0, '${ENFORCER_DIR}'); ` +
    `from canonical_main_enforcer import evaluate_path; ` +
    `r = evaluate_path(${JSON.stringify(p)}, ${JSON.stringify(REPO_ROOT)}); ` +
    `print(r[0])`;
  const result = spawnSync('python3', ['-c', driver], { encoding: 'utf8' });
  if (result.status !== 0) throw new Error(`python: ${result.stderr}`);
  return result.stdout.trim() === 'True';
}

test('stress: ALL allowlist paths are ALLOWED (≥99% precision target)', () => {
  let allowed = 0;
  let rejected = 0;
  for (const p of ALLOWED_CORPUS) {
    if (evaluatePath(p)) allowed++; else rejected++;
  }
  const precision = allowed / ALLOWED_CORPUS.length;
  console.log(`Allowlist precision: ${allowed}/${ALLOWED_CORPUS.length} = ${(precision * 100).toFixed(1)}%`);
  expect(precision).toBeGreaterThanOrEqual(0.99);
});

test('stress: ALL tracked paths are REJECTED (zero false-allow target)', () => {
  let rejected = 0;
  for (const p of TRACKED_CORPUS) {
    if (!evaluatePath(p)) rejected++;
  }
  expect(rejected).toBe(TRACKED_CORPUS.length);
});

test('stress: adversarial path injection attempts are REJECTED', () => {
  // Path-traversal attempts and other shenanigans must NOT bypass the enforcer.
  const adversarial = [
    '../etc/passwd', '../../../tmp/escape',
    'README.md/../../../../etc/hosts',
    '.env/../README.md',
  ];
  for (const p of adversarial) {
    expect(evaluatePath(p)).toBe(false);
  }
});

test('stress: 30 randomized untracked-and-not-ignored paths are ALL REJECTED', () => {
  const seeded = Array.from({ length: 30 }, (_, i) => `random-untracked-${i}-${Date.now()}.md`);
  let rejected = 0;
  for (const p of seeded) {
    if (!evaluatePath(p)) rejected++;
  }
  expect(rejected).toBe(seeded.length);
});

test('stress: enforcer p99 latency under 200ms per call', () => {
  const samples = [];
  for (let i = 0; i < 20; i++) {
    const start = Date.now();
    evaluatePath('.env');
    samples.push(Date.now() - start);
  }
  samples.sort((a, b) => a - b);
  const p99 = samples[Math.floor(samples.length * 0.99)];
  console.log(`enforcer p99 latency: ${p99}ms (target <200ms)`);
  expect(p99).toBeLessThan(200);
});
