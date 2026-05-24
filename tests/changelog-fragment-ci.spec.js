// changelog-fragment-ci.spec.js (#2128) — Golden-file test simulating the
// `lint-required` workflow step `node scripts/global/changelog-aggregate.js --validate-only`.
// Verifies that valid fragments pass and each T3/T4 violation triggers a clear
// error message. Mirrors the CI invocation exactly (--validate-only mode, no mutation).

const { test, expect } = require('@playwright/test');
const path = require('path');
const fs = require('fs');
const os = require('os');
const A = require(path.resolve(__dirname, '..', 'scripts', 'global', 'changelog-aggregate.js'));

const FIX_VALID = path.resolve(__dirname, 'fixtures', 'changelog-fragments-valid');
const FIX_INVALID = path.resolve(__dirname, 'fixtures', 'changelog-fragments-invalid');

function copyTo(srcDir, fileName) {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'ci-frag-'));
  fs.copyFileSync(path.join(srcDir, fileName), path.join(tmp, fileName));
  return { dir: tmp, cleanup: () => fs.rmSync(tmp, { recursive: true }) };
}

test('CI: valid fragment passes --validate-only', () => {
  const { dir, cleanup } = copyTo(FIX_VALID, '9001.md');
  const before = fs.readdirSync(dir);
  const result = A.aggregate({ dir, changelog: '/dev/null', validateOnly: true });
  expect(result.validateOnly).toBe(true);
  expect(result.count).toBe(1);
  expect(fs.readdirSync(dir)).toEqual(before); // no mutation
  cleanup();
});

test('CI: T3 h1-in-fragment fixture is rejected with line-cited error', () => {
  const { dir, cleanup } = copyTo(FIX_INVALID, 'h1-in-fragment.md');
  expect(() => A.aggregate({ dir, changelog: '/dev/null', validateOnly: true }))
    .toThrow(/h1-in-fragment\.md:1 T3-h1-in-fragment/);
  cleanup();
});

test('CI: T3 h2-in-fragment fixture is rejected with line-cited error', () => {
  const { dir, cleanup } = copyTo(FIX_INVALID, 'h2-in-fragment.md');
  expect(() => A.aggregate({ dir, changelog: '/dev/null', validateOnly: true }))
    .toThrow(/h2-in-fragment\.md:1 T3-h2-in-fragment/);
  cleanup();
});

test('CI: T4 bad-top-level fixture is rejected with line-cited error', () => {
  const { dir, cleanup } = copyTo(FIX_INVALID, 'bad-top-level.md');
  expect(() => A.aggregate({ dir, changelog: '/dev/null', validateOnly: true }))
    .toThrow(/bad-top-level\.md:1 T4-bad-top-level/);
  cleanup();
});

test('CI: T4 heading-skip fixture is rejected with line-cited error', () => {
  const { dir, cleanup } = copyTo(FIX_INVALID, 'heading-skip.md');
  expect(() => A.aggregate({ dir, changelog: '/dev/null', validateOnly: true }))
    .toThrow(/heading-skip\.md:3 T4-heading-increment-skip/);
  cleanup();
});

test('CI: empty fragments dir returns count=0 (T7 safety, not a failure)', () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'ci-empty-'));
  const result = A.aggregate({ dir: tmp, changelog: '/dev/null', validateOnly: true });
  expect(result.count).toBe(0);
  expect(result.skipped).toBe('empty');
  fs.rmSync(tmp, { recursive: true });
});
