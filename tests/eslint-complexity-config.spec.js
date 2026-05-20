// Validates that the ESLint config carries the complexity rule per #1971.
// Lane: code-change. test_strategy: tdd-pyramid.

const { test, expect } = require('@playwright/test');
const path = require('path');
const fs = require('fs');

const CONFIG_PATH = path.resolve(__dirname, '..', 'lint-configs', 'eslint.config.devenv.js');
const REPORT = path.resolve(__dirname, '..', 'scripts', 'global', 'complexity-report.js');

test('eslint config declares complexity rule with threshold 10', async () => {
  const src = fs.readFileSync(CONFIG_PATH, 'utf8');
  expect(src).toMatch(/complexity:\s*\[\s*['"](?:warn|error)['"]\s*,\s*10\s*\]/);
});

test('complexity-report.js exports expected functions', async () => {
  expect(fs.existsSync(REPORT)).toBe(true);
  const mod = require(REPORT);
  expect(typeof mod.runEslintJson).toBe('function');
  expect(typeof mod.extractComplexityViolations).toBe('function');
  expect(typeof mod.writeReport).toBe('function');
});

test('extractComplexityViolations filters by ruleId', async () => {
  const { extractComplexityViolations } = require(REPORT);
  const sample = [
    { filePath: '/repo/a.js', messages: [
      { ruleId: 'complexity', line: 10, column: 1, message: 'too complex', severity: 1 },
      { ruleId: 'no-unused-vars', line: 5, column: 1, message: 'unused', severity: 1 },
    ] },
    { filePath: '/repo/b.js', messages: [] },
  ];
  const out = extractComplexityViolations(sample);
  expect(out.length).toBe(1);
  expect(out[0].message).toBe('too complex');
});

test('rule mode is warn (replay-eval-gated promotion per #1771 pattern)', async () => {
  const src = fs.readFileSync(CONFIG_PATH, 'utf8');
  expect(src).toMatch(/complexity:\s*\[\s*['"]warn['"]\s*,\s*10\s*\]/);
});
