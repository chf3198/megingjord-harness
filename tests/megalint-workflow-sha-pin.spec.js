// Tests for scripts/global/megalint/workflow-sha-pin.js (Epic #1510 #1520).
const { test, expect } = require('@playwright/test');
const rule = require('../scripts/global/megalint/workflow-sha-pin');

const wf = (uses) => `jobs:\n  build:\n    runs-on: ubuntu-latest\n    steps:\n${uses.map((u) => '      - uses: ' + u).join('\n')}\n`;

test('#1520 AC2: parseUseRef recognizes SHA-pinned third-party action as OK', () => {
  const parsed = rule.parseUseRef('actions/checkout@34e114876b0b11c390a56381ad16ebd13914f8d5');
  expect(parsed.ok).toBe(true);
  expect(parsed.isSha).toBe(true);
});

test('#1520 AC2: parseUseRef flags @v3 / @v4 tag refs', () => {
  for (const tag of ['actions/checkout@v3', 'actions/checkout@v4', 'actions/setup-node@v5']) {
    const parsed = rule.parseUseRef(tag);
    expect(parsed.ok, tag).toBe(false);
  }
});

test('#1520 AC2: parseUseRef flags @main or @latest', () => {
  for (const ref of ['actions/checkout@main', 'actions/checkout@latest', 'foo/bar@release']) {
    expect(rule.parseUseRef(ref).ok, ref).toBe(false);
  }
});

test('#1520 AC2: repo-owned ./ workflow refs are OK', () => {
  expect(rule.parseUseRef('./.github/workflows/reusable.yml').kind).toBe('repo-owned');
  expect(rule.parseUseRef('./.github/workflows/reusable.yml').ok).toBe(true);
});

test('#1520 AC2: unparseable refs are passed through as OK (no false positive)', () => {
  // No @ symbol — could be a local file or malformed; let other lints catch.
  expect(rule.parseUseRef('local-step-no-version').ok).toBe(true);
});

test('#1520 AC2: validate scans all uses in a workflow', () => {
  const yaml = wf([
    'actions/checkout@34e114876b0b11c390a56381ad16ebd13914f8d5',
    'actions/setup-node@v4',
    'actions/github-script@f28e40c7f34bde8b3046d885e986cb6290c5673b',
    './.github/workflows/reusable.yml',
  ]);
  const result = rule.validate({ workflowContent: yaml });
  expect(result.ok).toBe(false);
  expect(result.violations).toHaveLength(1);
  expect(result.violations[0].action).toBe('actions/setup-node');
  expect(result.violations[0].version).toBe('v4');
  expect(result.scanned).toBe(4);
});

test('#1520 AC2: all-pinned workflow passes', () => {
  const yaml = wf([
    'actions/checkout@34e114876b0b11c390a56381ad16ebd13914f8d5',
    'actions/github-script@f28e40c7f34bde8b3046d885e986cb6290c5673b',
  ]);
  const result = rule.validate({ workflowContent: yaml });
  expect(result.ok).toBe(true);
  expect(result.violations).toHaveLength(0);
});

test('#1520 AC2: empty / null workflow content is safe', () => {
  expect(rule.validate({ workflowContent: '' }).ok).toBe(true);
  expect(rule.validate({}).ok).toBe(true);
});

test('#1520 AC2: SHA must be exactly 40 hex chars (39 or 41 is not a SHA)', () => {
  expect(rule.SHA40_RE.test('a'.repeat(40))).toBe(true);
  expect(rule.SHA40_RE.test('a'.repeat(39))).toBe(false);
  expect(rule.SHA40_RE.test('a'.repeat(41))).toBe(false);
  expect(rule.SHA40_RE.test('g'.repeat(40))).toBe(false); // g is not hex
});

test('#1520 AC4: registered in megalint VALIDATORS map', () => {
  const megalint = require('../scripts/global/megalint');
  expect(megalint.VALIDATORS).toHaveProperty('workflow-sha-pin');
});
