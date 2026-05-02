// Tests for #797 Drift-equivalent doc anchor checker
const { test, expect } = require('@playwright/test');
const fs = require('fs');
const path = require('path');
const os = require('os');
const { execSync } = require('child_process');

const SCRIPT = path.resolve(__dirname, '..', 'scripts', 'global', 'docs-anchors.js');

let tmpDir;

test.beforeEach(() => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'anchors-test-'));
});

test.afterEach(() => {
  fs.rmSync(tmpDir, { recursive: true, force: true });
});

function run(args = '') {
  try {
    return { ok: true, stdout: execSync(`node ${SCRIPT} ${args}`, { cwd: tmpDir, encoding: 'utf-8' }) };
  } catch (err) {
    return { ok: false, stdout: err.stdout || '', stderr: err.stderr || '' };
  }
}

function write(name, content) {
  fs.writeFileSync(path.join(tmpDir, name), content);
}

test('passes when no anchors are present', () => {
  write('readme.md', '# No anchors here\n\nJust prose.\n');
  const r = run();
  expect(r.ok).toBe(true);
  expect(r.stdout).toContain('in sync');
});

test('flags an anchor without a hash', () => {
  write('lib.js', 'function foo() { return 1; }\n');
  write('doc.md', '<!-- anchor: lib.js -->\nDescribes foo.\n');
  const r = run();
  expect(r.ok).toBe(false);
  expect(r.stderr + r.stdout).toMatch(/missing hash/);
});

test('--fix populates missing hashes', () => {
  write('lib.js', 'function foo() { return 1; }\n');
  write('doc.md', '<!-- anchor: lib.js -->\nDescribes foo.\n');
  run('--fix');
  const updated = fs.readFileSync(path.join(tmpDir, 'doc.md'), 'utf-8');
  expect(updated).toMatch(/hash:[0-9a-f]{12}/);
});

test('passes when declared hash matches current content', () => {
  write('lib.js', 'function foo() { return 1; }\n');
  write('doc.md', '<!-- anchor: lib.js -->\n');
  run('--fix');
  const r = run();
  expect(r.ok).toBe(true);
  expect(r.stdout).toContain('in sync');
});

test('fails when anchored code changes without doc update', () => {
  write('lib.js', 'function foo() { return 1; }\n');
  write('doc.md', '<!-- anchor: lib.js -->\n');
  run('--fix');
  write('lib.js', 'function foo() { return 99; }\n');
  const r = run();
  expect(r.ok).toBe(false);
  expect(r.stderr + r.stdout).toMatch(/anchor drift/);
});

test('flags a missing anchor target', () => {
  write('doc.md', '<!-- anchor: missing.js hash:0123456789ab -->\n');
  const r = run();
  expect(r.ok).toBe(false);
  expect(r.stderr + r.stdout).toMatch(/anchor target missing/);
});

test('line-range anchors hash the slice not the whole file', () => {
  write('lib.js', 'line1\nline2\nline3\nline4\n');
  write('doc.md', '<!-- anchor: lib.js#L2-L3 -->\n');
  run('--fix');
  write('lib.js', 'line1\nline2\nline3\nline4-CHANGED\n');
  expect(run().ok).toBe(true);
});

test('line-range anchors fail when the slice changes', () => {
  write('lib.js', 'line1\nline2\nline3\nline4\n');
  write('doc.md', '<!-- anchor: lib.js#L2-L3 -->\n');
  run('--fix');
  write('lib.js', 'line1\nline2-CHANGED\nline3\nline4\n');
  const r = run();
  expect(r.ok).toBe(false);
  expect(r.stderr + r.stdout).toMatch(/anchor drift/);
});
