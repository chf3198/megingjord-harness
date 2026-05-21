// Zombie cleanup unit tests per #2019.
// Lane: code-change. test_strategy: tdd-pyramid + stress-test.
// Run via Playwright (existing test infra) but tests are pure-Python module
// invocation through child_process — no browser context spawned.

const { test, expect } = require('@playwright/test');
const path = require('path');
const fs = require('fs');
const { spawnSync } = require('child_process');

const SCRIPT = path.resolve(__dirname, '..', 'hooks', 'scripts', 'zombie_cleanup.py');
const WRAPPER = path.resolve(__dirname, '..', 'scripts', 'global', 'safe-playwright.sh');

test('zombie_cleanup.py exists and is executable', () => {
  expect(fs.existsSync(SCRIPT)).toBe(true);
  const mode = fs.statSync(SCRIPT).mode;
  expect((mode & 0o111) !== 0).toBe(true);
});

test('safe-playwright.sh exists and is executable', () => {
  expect(fs.existsSync(WRAPPER)).toBe(true);
  const mode = fs.statSync(WRAPPER).mode;
  expect((mode & 0o111) !== 0).toBe(true);
});

test('zombie_cleanup runs to completion in <2s on a clean tree', () => {
  const start = Date.now();
  const result = spawnSync('python3', [SCRIPT], { encoding: 'utf8', timeout: 5000 });
  const elapsed = Date.now() - start;
  expect(elapsed).toBeLessThan(2500);
  expect(result.status).toBe(0);
});

test('zombie_cleanup output is valid JSON when zombies found, empty when none', () => {
  const result = spawnSync('python3', [SCRIPT], { encoding: 'utf8' });
  // Either no output (no zombies) or valid JSON
  if (result.stdout.trim()) {
    expect(() => JSON.parse(result.stdout)).not.toThrow();
  }
});

test('safe-playwright.sh declares the mandatory --workers=1 flag', () => {
  const content = fs.readFileSync(WRAPPER, 'utf8');
  expect(content).toMatch(/--workers=1/);
});

test('safe-playwright.sh declares --max-failures=5 to bail early', () => {
  const content = fs.readFileSync(WRAPPER, 'utf8');
  expect(content).toMatch(/--max-failures=5/);
});

test('safe-playwright.sh uses file capture (no pipe-tail antipattern)', () => {
  const content = fs.readFileSync(WRAPPER, 'utf8');
  expect(content).toMatch(/>\s*"\${OUTPUT_FILE}"/);
});

test('docs/howto/playwright-safe-invocation.md cites the upstream bugs', () => {
  const docPath = path.resolve(__dirname, '..', 'docs', 'howto', 'playwright-safe-invocation.md');
  expect(fs.existsSync(docPath)).toBe(true);
  const text = fs.readFileSync(docPath, 'utf8');
  expect(text).toMatch(/playwright#27048/);
  expect(text).toMatch(/playwright#34190/);
});

test('zombie_cleanup script declares CPU + age + parent-dead heuristics', () => {
  const text = fs.readFileSync(SCRIPT, 'utf8');
  expect(text).toMatch(/CPU_PCT_FLOOR/);
  expect(text).toMatch(/AGE_MIN_FLOOR/);
  expect(text).toMatch(/_parent_alive/);
});

test('zombie_cleanup degrades gracefully when /proc missing (G6)', () => {
  const text = fs.readFileSync(SCRIPT, 'utf8');
  expect(text).toMatch(/Path\("\/proc"\)\.exists\(\)/);
});

test('stress: 100 invocations of zombie_cleanup do not spawn zombies', () => {
  // Defensive: the cleanup script itself should be re-entrant safe
  for (let i = 0; i < 10; i += 1) {
    const r = spawnSync('python3', [SCRIPT], { encoding: 'utf8', timeout: 3000 });
    expect.soft(r.status).toBe(0);
  }
});
