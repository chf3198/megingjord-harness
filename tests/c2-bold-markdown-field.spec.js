// C2 (#3030 AC2): extractField tolerates bold-markdown **field:**
const { test, expect } = require('@playwright/test');
const path = require('path');
const mh = require(path.resolve(
  __dirname, '..', 'scripts', 'global', 'megalint', 'manager-handoff.js'
));

const FIXTURES = [
  { label: 'plain field', body: '\nscope: fix the parser', val: 'fix the parser' },
  { label: 'list-prefixed', body: '\n- scope: fix the parser', val: 'fix the parser' },
  { label: 'bold **field:**', body: '\n**scope:** fix the parser', val: 'fix the parser' },
  { label: 'bold **field**:', body: '\n**scope**: fix the parser', val: 'fix the parser' },
  { label: 'star-prefixed', body: '\n* scope: fix the parser', val: 'fix the parser' },
  { label: 'leading whitespace', body: '\n  scope: fix the parser', val: 'fix the parser' },
  { label: 'mixed bold + list', body: '\n- **scope:** fix the parser', val: 'fix the parser' },
];

for (const { label, body, val } of FIXTURES) {
  test(`extractField parses ${label}`, () => {
    expect(mh.extractField(body, 'scope')).toBe(val);
  });
}

test('extractField returns null for absent field', () => {
  expect(mh.extractField('no fields here', 'scope')).toBeNull();
});

// Full MANAGER_HANDOFF validation with bold-markdown fields
test('validate passes with bold-markdown fields (#3030 AC2)', () => {
  const body = [
    '## MANAGER_HANDOFF',
    '**scope:** Fix the field parser for bold markdown',
    '**lane:** lane:code-change',
    '**test_strategy:** tdd-pyramid',
    '**acceptance:** Parser handles all bold forms',
    '**gates:** CI green',
    '**related_tickets:** #3021',
    '**overlap_decision:** none',
    'Signed-by: Quill Mason',
    'Team&Model: codex:gpt-5.4@codex-cli',
    'Role: manager',
  ].join('\n');
  const r = mh.validate({ comments: [{ body }] });
  expect(r.found).toBe(true);
  const fieldViolations = r.violations.filter(
    v => v.rule.startsWith('missing-')
      && !v.rule.includes('signer')
      && !v.rule.includes('team-model')
      && !v.rule.includes('role-manager')
  );
  expect(fieldViolations).toEqual([]);
});
