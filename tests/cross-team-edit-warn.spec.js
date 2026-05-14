const assert = require('assert');

function teamOf(issue) {
  const team = (issue.labels || []).find((l) => l.startsWith('team:'));
  return team || `user:${issue.user}`;
}

function siblingRoleConflicts(issue, siblings, role) {
  const thisTeam = teamOf(issue);
  return siblings.filter(
    (s) =>
      s.number !== issue.number &&
      s.labels.includes(role) &&
      teamOf(s) !== thisTeam
  );
}

(function run() {
  const issue = {
    number: 501,
    user: 'copilot-bot',
    labels: ['role:collaborator', 'team:copilot']
  };
  const siblings = [
    { number: 502, user: 'claude-bot', labels: ['role:collaborator', 'team:claude-code'] },
    { number: 503, user: 'codex-bot', labels: ['role:admin', 'team:codex'] },
    { number: 504, user: 'copilot-bot', labels: ['role:collaborator', 'team:copilot'] }
  ];

  const conflicts = siblingRoleConflicts(issue, siblings, 'role:collaborator');
  assert.strictEqual(conflicts.length, 1);
  assert.strictEqual(conflicts[0].number, 502);

  const none = siblingRoleConflicts(issue, siblings, 'role:consultant');
  assert.strictEqual(none.length, 0);

  console.log('cross-team-edit-warn sibling-role test: PASS');
})();
