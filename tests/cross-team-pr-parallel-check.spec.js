const assert = require('assert');
const {
  extractTeamModelFromText,
  resolveParallelIdentity,
  isParallelPair,
} = require('../scripts/global/cross-team-pr-parallel-check');

(function run() {
  assert.strictEqual(
    extractTeamModelFromText('Signed-by: X\nTeam&Model: copilot:gpt-5.4-mini@local\nRole: collaborator'),
    'copilot:gpt-5.4-mini@local'
  );
  assert.strictEqual(
    extractTeamModelFromText('AI-Team-Model: codex:gpt-5.4@codex-cli'),
    'codex:gpt-5.4@codex-cli'
  );

  const sameLoginDifferentTeam = {
    user: { login: 'curtisfranks' },
    body: 'Team&Model: copilot:gpt-5.4-mini@local',
  };
  const sameLoginDifferentTeamOther = {
    user: { login: 'curtisfranks' },
    body: 'Team&Model: claude-code:opus-4-7@anthropic',
  };
  const sameLoginSameTeam = {
    user: { login: 'curtisfranks' },
    body: 'Team&Model: copilot:gpt-5.4-mini@local',
  };

  assert.strictEqual(resolveParallelIdentity(sameLoginDifferentTeam).value, 'copilot:gpt-5.4-mini@local');
  assert.strictEqual(resolveParallelIdentity(sameLoginDifferentTeamOther).value, 'claude-code:opus-4-7@anthropic');
  assert.strictEqual(isParallelPair(sameLoginDifferentTeam, sameLoginDifferentTeamOther), true);
  assert.strictEqual(isParallelPair(sameLoginDifferentTeam, sameLoginSameTeam), false);

  const fallbackLogin = resolveParallelIdentity({ user: { login: 'curtisfranks' }, body: '' });
  assert.strictEqual(fallbackLogin.source, 'login');
  assert.strictEqual(fallbackLogin.value, 'curtisfranks');

  console.log('cross-team-pr-parallel-check identity tests: PASS');
})();
