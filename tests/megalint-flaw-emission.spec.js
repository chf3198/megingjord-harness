const { test, expect } = require('@playwright/test');
const rule = require('../scripts/global/megalint/flaw-emission');

const c = body => ({ body });

test('#1555: skip when no flaw mentions', () => {
  const result = rule.validate({ comments: [c('## COLLABORATOR_HANDOFF\nAll good.')] });
  expect(result.ok).toBe(true);
  expect(result.skipped).toBe('no-flaw-mentions');
});

test('#1555 AC2: passes when flaw mention includes nearby artifact citation', () => {
  const body = '## CONSULTANT_CLOSEOUT\nI had to work around a side-effect\nartifact: #1554';
  const result = rule.validate({ comments: [c(body)] });
  expect(result.ok).toBe(true);
  expect(result.mentions).toBeGreaterThan(0);
});

test('#1555 AC2: fails when flaw mention lacks citation', () => {
  const body = '## COLLABORATOR_HANDOFF\nI had to patch around a bug in workflow';
  const result = rule.validate({ comments: [c(body)] });
  expect(result.ok).toBe(false);
  expect(result.violations[0].rule).toBe('flaw-mention-missing-anneal-artifact');
});

test('#1555: registered in megalint VALIDATORS map', () => {
  const megalint = require('../scripts/global/megalint');
  expect(megalint.VALIDATORS).toHaveProperty('flaw-emission');
  const result = megalint.run('flaw-emission', { comments: [c('## CONSULTANT_CLOSEOUT\nflaw fixed\n#1')] });
  expect(result.ok).toBe(true);
});
