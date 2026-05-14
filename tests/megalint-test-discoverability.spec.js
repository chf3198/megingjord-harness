// Tests for scripts/global/megalint/test-discoverability.js (Epic #1510 #1520).
const { test, expect } = require('@playwright/test');
const rule = require('../scripts/global/megalint/test-discoverability');

test('#1520 AC3: spec file with @playwright/test require() passes', () => {
  const result = rule.validateFile(
    'tests/foo.spec.js',
    `const { test, expect } = require('@playwright/test');\ntest('x', () => {});`,
  );
  expect(result.ok).toBe(true);
});

test('#1520 AC3: spec file with @playwright/test ESM import passes', () => {
  const result = rule.validateFile(
    'tests/foo.spec.js',
    `import { test, expect } from '@playwright/test';\ntest('x', () => {});`,
  );
  expect(result.ok).toBe(true);
});

test('#1520 AC3: bare `require("assert")` spec file FAILS', () => {
  const result = rule.validateFile(
    'tests/legacy.spec.js',
    `const assert = require('assert');\nassert.strictEqual(1, 1);`,
  );
  expect(result.ok).toBe(false);
  expect(result.violations[0].rule).toBe('test-not-playwright-discoverable');
  expect(result.violations[0].filePath).toBe('tests/legacy.spec.js');
});

test('#1520 AC3: opt-out comment suppresses violation', () => {
  const result = rule.validateFile(
    'tests/cli-script.spec.js',
    `// @megalint:test-discoverability:opt-out — intentional CLI script\nconst assert = require('assert');`,
  );
  expect(result.ok).toBe(true);
  expect(result.skipped).toBe('opt-out-comment-present');
});

test('#1520 AC3: non-spec files are ignored', () => {
  expect(rule.validateFile('src/index.js', 'no playwright').ok).toBe(true);
  expect(rule.validateFile('tests/helpers/util.js', 'no playwright').ok).toBe(true);
  expect(rule.validateFile('scripts/foo.js', 'no playwright').ok).toBe(true);
});

test('#1520 AC3: .ts spec files are evaluated too', () => {
  const ok = rule.validateFile(
    'tests/foo.spec.ts',
    `import { test } from '@playwright/test';\ntest('x', () => {});`,
  );
  const bad = rule.validateFile('tests/foo.spec.ts', `import 'assert';`);
  expect(ok.ok).toBe(true);
  expect(bad.ok).toBe(false);
});

test('#1520 AC3: shouldEvaluate recognizes tests/*.spec.js pattern', () => {
  expect(rule.shouldEvaluate('tests/foo.spec.js')).toBe(true);
  expect(rule.shouldEvaluate('tests/foo.spec.ts')).toBe(true);
  expect(rule.shouldEvaluate('/some/path/tests/foo.spec.js')).toBe(true);
  expect(rule.shouldEvaluate('tests/helpers/util.js')).toBe(false);
  expect(rule.shouldEvaluate('src/foo.spec.js')).toBe(false);
  expect(rule.shouldEvaluate('')).toBe(false);
});

test('#1520 AC3: batch validate scans all files in input', () => {
  const files = [
    { path: 'tests/a.spec.js', content: `require('@playwright/test')` },
    { path: 'tests/b.spec.js', content: `require('assert')` },
    { path: 'tests/c.spec.js', content: `require('assert')` },
    { path: 'src/d.js', content: 'whatever' },
  ];
  const result = rule.validate({ testFiles: files });
  expect(result.ok).toBe(false);
  expect(result.violations).toHaveLength(2);
  expect(result.scanned).toBe(4);
});

test('#1520 AC3: empty input is safe', () => {
  expect(rule.validate({}).ok).toBe(true);
  expect(rule.validate({ testFiles: [] }).ok).toBe(true);
});

test('#1520 AC4: registered in megalint VALIDATORS map', () => {
  const megalint = require('../scripts/global/megalint');
  expect(megalint.VALIDATORS).toHaveProperty('test-discoverability');
});
