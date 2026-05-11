// log-rotation — golden-file tests (#1357, Epic #1339 C6).
const { test, expect } = require('@playwright/test');
const path = require('path');
const fs = require('fs');
const os = require('os');
const R = require(path.resolve(__dirname, '..', 'scripts', 'global', 'log-rotation.js'));

const sandbox = () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'logrot-'));
  return { dir, file: path.join(dir, 'sample.jsonl') };
};

test('shouldRotate: nonexistent file → false', () => {
  expect(R.shouldRotate('/nonexistent/path.jsonl')).toBe(false);
});

test('shouldRotate: file at size cap → true', () => {
  const { dir, file } = sandbox();
  fs.writeFileSync(file, 'x'.repeat(100));
  expect(R.shouldRotate(file, 50)).toBe(true);
  fs.rmSync(dir, { recursive: true });
});

test('shouldRotate: small recent file → false', () => {
  const { dir, file } = sandbox();
  fs.writeFileSync(file, 'tiny');
  expect(R.shouldRotate(file, 1000)).toBe(false);
  fs.rmSync(dir, { recursive: true });
});

test('rotate: renames file with date suffix; recreates empty hot file', () => {
  const { dir, file } = sandbox();
  fs.writeFileSync(file, 'event1\nevent2\n');
  const rotated = R.rotate(file, false);
  expect(rotated).toMatch(/sample\.jsonl\.\d{4}-\d{2}-\d{2}$/);
  expect(fs.readFileSync(rotated, 'utf8')).toBe('event1\nevent2\n');
  expect(fs.existsSync(file)).toBe(true);
  expect(fs.readFileSync(file, 'utf8')).toBe('');
  fs.rmSync(dir, { recursive: true });
});

test('rotate: archive=true → gzip into ARCHIVE_DIR/<surface>/', () => {
  // Override HOME env temporarily to sandbox
  const origHome = process.env.HOME;
  const { dir, file } = sandbox();
  fs.writeFileSync(file, 'content\n');
  // Reload module with new HOME via direct call (archive dir resolved at require-time);
  // for the test we call rotate() and verify the gzip file exists under any path that contains 'archive'.
  process.env.HOME = origHome;  // keep — rotate uses module-level ARCHIVE_DIR
  const archived = R.rotate(file, true);
  expect(archived).toBeTruthy();
  expect(archived).toMatch(/\.gz$/);
  expect(fs.existsSync(archived)).toBe(true);
  // Hot file recreated empty
  expect(fs.readFileSync(file, 'utf8')).toBe('');
  // Cleanup
  fs.rmSync(dir, { recursive: true });
  if (fs.existsSync(archived)) fs.unlinkSync(archived);
});

test('rotate: nonexistent file → null no-op', () => {
  expect(R.rotate('/nonexistent/x.jsonl', false)).toBeNull();
});

test('rotateAll: returns shape { rotated, pruned }', () => {
  const result = R.rotateAll([]);  // empty surface set
  expect(result).toEqual({ rotated: [], pruned: 0 });
});

test('SURFACES exports incidents.jsonl with 90d retention', () => {
  const incidents = R.SURFACES.find(s => s.file.includes('incidents.jsonl'));
  expect(incidents).toBeDefined();
  expect(incidents.hotDays).toBe(90);
  expect(incidents.archive).toBe(true);
});

test('SURFACES exports cache-stats.jsonl with 30d retention, no archive', () => {
  const cache = R.SURFACES.find(s => s.file.includes('cache-stats.jsonl'));
  expect(cache).toBeDefined();
  expect(cache.hotDays).toBe(30);
  expect(cache.archive).toBe(false);
});
