const assert = require('assert');
const { buildBatonComment } = require('../scripts/global/baton-comment-build');

(function run() {
  const text = buildBatonComment({
    artifact: 'MANAGER_HANDOFF',
    ticket: '1487',
    role: 'manager',
    teamModel: 'copilot:gpt-5.4-mini@local',
    summary: 'enforce signer aliases',
  });
  assert(/## MANAGER_HANDOFF/.test(text));
  assert(/ticket: #1487/.test(text));
  assert(/Signed-by: Milo Mason/.test(text));
  assert(/Team&Model: copilot:gpt-5.4-mini@local/.test(text));
  assert(/Role: manager/.test(text));

  const c = buildBatonComment({
    artifact: 'COLLABORATOR_HANDOFF', role: 'collaborator',
    teamModel: 'claude-code:opus-4-7@anthropic',
  });
  assert(/Signed-by: Orla Harper/.test(c));

  const x = buildBatonComment({
    artifact: 'ADMIN_HANDOFF', role: 'admin',
    teamModel: 'codex:gpt-5.4@codex-cli',
  });
  assert(/Signed-by: Quill Reyes/.test(x));
  console.log('baton-comment-build tests: PASS');
})();
