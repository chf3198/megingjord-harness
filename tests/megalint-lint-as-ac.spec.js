// Tests for scripts/global/megalint/lint-as-ac.js (Epic #1510 #1520).
const { test, expect } = require('@playwright/test');
const rule = require('../scripts/global/megalint/lint-as-ac');

const body = (acs) =>
  `## Some section\n\nOther text.\n\n## Acceptance Criteria\n\n${acs.map((a) => '- [ ] ' + a).join('\n')}\n`;

test('#1520 AC1: catches the exact #1500 / #1508 pattern (all files ≤ N lines)', () => {
  const result = rule.validate({ body: body(['AC1: All new files ≤ 100 lines.']) });
  expect(result.ok).toBe(false);
  expect(result.violations[0].rule).toBe('lint-as-ac');
  expect(result.violations[0].ac).toContain('All new files ≤ 100 lines');
});

test('#1520 AC1: catches case-insensitive variants', () => {
  const cases = [
    'AC: all files must be under 100 line.',
    'AC2: every file is within 80 lines.',
    'AC3: files <= 100 lines',
  ];
  for (const ac of cases) {
    const result = rule.validate({ body: body([ac]) });
    expect(result.ok, ac).toBe(false);
  }
});

test('#1520 AC1: catches named-tool restate', () => {
  const cases = [
    'AC: prettier clean',
    'AC2: ESLint passes',
    'AC3: markdownlint green',
    'AC4: ruff passes',
    'AC5: shellcheck clean',
  ];
  for (const ac of cases) {
    const result = rule.validate({ body: body([ac]) });
    expect(result.ok, ac).toBe(false);
  }
});

test('#1520 AC1: catches generic "lint clean/green/passes" restate', () => {
  for (const phrase of ['lint clean', 'lint green', 'lint passes', 'lint passed']) {
    const result = rule.validate({ body: body([`AC: ${phrase}`]) });
    expect(result.ok, phrase).toBe(false);
  }
});

test('#1520 AC1: catches "format:check green" restate', () => {
  const result = rule.validate({ body: body(['AC: format:check green']) });
  expect(result.ok).toBe(false);
});

test('#1520 AC1: legitimate "new rule" ACs do NOT trigger (additive hint)', () => {
  const cases = [
    'AC: New rule catches files exceeding 100 lines',
    'AC: Add a lint rule that detects 100-line files',
    'AC: Megalint validator flags lint-clean restate',
    'AC: New validator detects prettier-clean ACs',
  ];
  for (const ac of cases) {
    const result = rule.validate({ body: body([ac]) });
    expect(result.ok, ac).toBe(true);
  }
});

test('#1520 AC1: ACs outside the "Acceptance Criteria" section are ignored', () => {
  const text = `## Test plan\n\n- [ ] AC1: all files ≤ 100 lines (this is a test step, not an AC)\n`;
  const result = rule.validate({ body: text });
  expect(result.ok).toBe(true);
});

test('#1520 AC1: section ends when a new header starts', () => {
  const text = `## Acceptance Criteria\n\n- [ ] AC1: New rule catches X\n\n## Test plan\n\n- [ ] All files ≤ 100 lines`;
  const result = rule.validate({ body: text });
  expect(result.ok).toBe(true);
});

test('#1520 AC1: ticked vs unticked ACs both evaluated', () => {
  const text = `## Acceptance Criteria\n\n- [x] AC1: All new files ≤ 100 lines.\n- [ ] AC2: Real work item.`;
  const result = rule.validate({ body: text });
  expect(result.ok).toBe(false);
  expect(result.violations[0].ac).toContain('All new files');
});

test('#1520 AC1: empty body is safe (no violations, no throw)', () => {
  expect(rule.validate({ body: '' }).ok).toBe(true);
  expect(rule.validate({}).ok).toBe(true);
  expect(rule.validate({ body: null }).ok).toBe(true);
});

test('#1520 AC4: registered in megalint VALIDATORS map', () => {
  const megalint = require('../scripts/global/megalint');
  expect(megalint.VALIDATORS).toHaveProperty('lint-as-ac');
  const result = megalint.run('lint-as-ac', { body: body(['AC: all files ≤ 100 lines.']) });
  expect(result.ok).toBe(false);
});
