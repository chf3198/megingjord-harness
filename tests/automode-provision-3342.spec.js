// #3342 Part A — conformance for the auto-mode baton-authorization provisioner.
const { test, expect } = require('@playwright/test');
const m = require('../scripts/global/automode-provision.js');

test('mergeAutoMode is non-clobbering and dedupes (G5/G9)', () => {
  const prior = { permissions: { allow: ['Bash(npm run lint)'] }, autoMode: { allow: ['$defaults', 'Keep prior rule'] } };
  const out = m.mergeAutoMode(prior);
  // existing sibling key preserved
  expect(out.permissions.allow).toContain('Bash(npm run lint)');
  // prior autoMode rule preserved
  expect(out.autoMode.allow).toContain('Keep prior rule');
  // baton rules added
  expect(out.autoMode.allow.some(r => r.includes('CONSULTANT_CLOSEOUT'))).toBe(true);
  // idempotent: applying twice does not duplicate
  const twice = m.mergeAutoMode(out);
  expect(twice.autoMode.allow.length).toBe(out.autoMode.allow.length);
});

test('authorization is SCOPED, not a blanket self-merge license (G1 negative-scope)', () => {
  const rules = m.BATON_AUTOMODE.autoMode.allow.filter(r => r !== '$defaults');
  // every merge-allowing rule names the reviewed-PR precondition
  const mergeRule = rules.find(r => /merg/i.test(r));
  expect(mergeRule).toBeTruthy();
  expect(mergeRule).toMatch(/CONSULTANT_CLOSEOUT/);
  expect(mergeRule).toMatch(/CI/);
  expect(mergeRule).toMatch(/policy:megingjord-baton-closeout-v1/);
  // no rule grants unconditional / arbitrary merge
  expect(rules.some(r => /merge (any|all|every|arbitrary)/i.test(r))).toBe(false);
});

test('verify reports absence cleanly when rules are not installed', () => {
  const r = m.verify();
  expect(typeof r.ok).toBe('boolean');
  if (!r.ok) expect(r.reason).toBe('baton-automode-rules-not-found');
});

test('managed path is preferred (agent-immutable) over user fallback', () => {
  expect(m.MANAGED_DROPIN).toContain('/etc/claude-code/managed-settings.d/');
  expect(m.USER_SETTINGS).toContain('.claude/settings.json');
});
