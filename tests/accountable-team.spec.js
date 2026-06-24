'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const {
  ACCOUNTABLE_TEAMS,
  DEFAULT_ACCOUNTABLE_TEAM,
  isValidAccountableTeam,
  canModifyAccountableTeam,
  teamFromLabel,
  teamFromSigningBlock,
  resolveAccountableTeam,
} = require('../scripts/global/accountable-team');
const { deriveBackfill } = require('../scripts/global/accountable-team-backfill');

test('the four harness teams are valid; unknown teams are not', () => {
  for (const team of ACCOUNTABLE_TEAMS) assert.equal(isValidAccountableTeam(team), true);
  assert.equal(isValidAccountableTeam('CLAUDE-CODE'), true, 'case-insensitive');
  assert.equal(isValidAccountableTeam('marketing'), false);
  assert.equal(isValidAccountableTeam(''), false);
});

test('authority rule: only manager and admin may modify accountable-team', () => {
  assert.equal(canModifyAccountableTeam('manager'), true);
  assert.equal(canModifyAccountableTeam('admin'), true);
  assert.equal(canModifyAccountableTeam('collaborator'), false);
  assert.equal(canModifyAccountableTeam('consultant'), false);
  assert.equal(canModifyAccountableTeam(undefined), false);
});

test('teamFromLabel parses the prefix and rejects others', () => {
  assert.equal(teamFromLabel('accountable-team:copilot'), 'copilot');
  assert.equal(teamFromLabel('accountable-team:unknown'), null);
  assert.equal(teamFromLabel('role:manager'), null);
  assert.equal(teamFromLabel('status:done'), null);
});

test('teamFromSigningBlock parses the Team&Model line', () => {
  assert.equal(teamFromSigningBlock('Team&Model: claude-code:opus@local'), 'claude-code');
  assert.equal(teamFromSigningBlock('Team&Model: copilot:gpt-5.3-codex@github-copilot'), 'copilot');
  assert.equal(teamFromSigningBlock('no signing block here'), null);
});

test('resolveAccountableTeam: explicit label wins (step 1)', () => {
  const out = resolveAccountableTeam(
    ['status:done', 'accountable-team:codex'],
    [{ body: 'Team&Model: claude-code:opus@local' }],
  );
  assert.deepEqual(out, { team: 'codex', source: 'label' });
});

test('resolveAccountableTeam: latest signing block when no label (step 2)', () => {
  const out = resolveAccountableTeam(
    ['status:done'],
    [
      { body: 'Team&Model: copilot:gpt-5.3-codex@github-copilot' },
      { body: 'Team&Model: claude-code:opus@local' },
    ],
  );
  assert.deepEqual(out, { team: 'claude-code', source: 'signing-block' }, 'most recent wins');
});

test('resolveAccountableTeam: default manager team when nothing else (step 3)', () => {
  const out = resolveAccountableTeam(['status:backlog'], []);
  assert.deepEqual(out, { team: DEFAULT_ACCOUNTABLE_TEAM, source: 'default' });
});

test('deriveBackfill skips already-tagged tickets and plans for untagged ones', () => {
  const plan = deriveBackfill([
    { number: 1, labels: ['status:done', 'accountable-team:copilot'], comments: [] },
    { number: 2, labels: ['status:done'], comments: [{ body: 'Team&Model: codex:gpt@openai' }] },
    { number: 3, labels: ['status:backlog'], comments: [] },
  ]);
  assert.equal(plan.length, 2, 'ticket 1 already tagged, skipped');
  assert.deepEqual(plan[0], { number: 2, addLabel: 'accountable-team:codex', source: 'signing-block' });
  assert.deepEqual(plan[1], { number: 3, addLabel: `accountable-team:${DEFAULT_ACCOUNTABLE_TEAM}`, source: 'default' });
});

test('deriveBackfill is idempotent: re-running over a tagged set plans nothing', () => {
  const tagged = [{ number: 9, labels: ['accountable-team:antigravity'], comments: [] }];
  assert.equal(deriveBackfill(tagged).length, 0);
});
