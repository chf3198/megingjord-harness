// Tests for #801 markdown opt-in exec runner
const { test, expect } = require('@playwright/test');
const fs = require('fs');
const path = require('path');
const os = require('os');
const { execSync } = require('child_process');

const SCRIPT = path.resolve(__dirname, '..', 'scripts', 'global', 'docs-exec.js');

let tmpDir;

test.beforeEach(() => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'exec-test-'));
});

test.afterEach(() => fs.rmSync(tmpDir, { recursive: true, force: true }));

function run() {
  try {
    return { ok: true, stdout: execSync(`node ${SCRIPT}`, { cwd: tmpDir, encoding: 'utf-8' }) };
  } catch (err) {
    return { ok: false, stdout: err.stdout || '', stderr: err.stderr || '' };
  }
}

function write(name, content) {
  fs.writeFileSync(path.join(tmpDir, name), content);
}

test('passes when no markers are present', () => {
  write('doc.md', '# Doc\n\n```bash\necho not-run\n```\n');
  const r = run();
  expect(r.ok).toBe(true);
  expect(r.stdout).toContain('0 opt-in');
});

test('runs marked block successfully', () => {
  write('doc.md', '<!-- exec: -->\n```bash\necho hello\n```\n');
  const r = run();
  expect(r.ok).toBe(true);
  expect(r.stdout).toContain('1 opt-in');
});

test('fails when marked block exits non-zero', () => {
  write('doc.md', '<!-- exec: -->\n```bash\nfalse\n```\n');
  const r = run();
  expect(r.ok).toBe(false);
  expect(r.stderr + r.stdout).toMatch(/exec block #1 failed/);
});

test('ignores blocks without the marker', () => {
  write('doc.md', '```bash\nfalse\n```\n');
  const r = run();
  expect(r.ok).toBe(true);
  expect(r.stdout).toContain('0 opt-in');
});

test('respects per-block timeout', () => {
  write('doc.md', '<!-- exec: timeout=1s -->\n```bash\nsleep 5\n```\n');
  const r = run();
  expect(r.ok).toBe(false);
  expect(r.stderr + r.stdout).toMatch(/exec block #1 failed/);
});

test('runs multiple blocks across multiple files', () => {
  write('a.md', '<!-- exec: -->\n```bash\necho A\n```\n');
  write('b.md', '<!-- exec: -->\n```bash\necho B\n```\n');
  const r = run();
  expect(r.ok).toBe(true);
  expect(r.stdout).toContain('2 opt-in');
});
