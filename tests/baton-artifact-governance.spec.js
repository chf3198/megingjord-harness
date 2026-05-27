const { test, expect } = require('@playwright/test');
const path = require('path');
const G = require(path.resolve(__dirname, '..', 'scripts', 'global', 'baton-artifact-governance.js'));
const { buildBatonComment } = require(path.resolve(__dirname, '..', 'scripts', 'global', 'baton-comment-build.js'));

function mk(artifact, role, teamModel) {
  return { body: buildBatonComment({ artifact, role, teamModel, ticket: 1728 }) };
}

test('passes for canonical baton artifacts', () => {
  const comments = [
    mk('MANAGER_HANDOFF', 'manager', 'copilot:gpt-5.3-codex@github-copilot'),
    mk('COLLABORATOR_HANDOFF', 'collaborator', 'codex:gpt-5.4@codex-cli'),
    mk('ADMIN_HANDOFF', 'admin', 'claude-code:opus-4-7@claude-code-cli'),
    mk('CONSULTANT_CLOSEOUT', 'consultant', 'openclaw:qwen2.5-coder:7b@openclaw-gateway/windows-laptop'),
  ];
  const r = G.analyzeComments(comments);
  expect(r.ok).toBe(true);
  expect(r.count).toBe(4);
});

test('fails on client-name signer injection', () => {
  const comments = [{
    body: '## MANAGER_HANDOFF\nSigned-by: Curtis Franks\nTeam&Model: codex:gpt-5.4@codex-cli\nRole: manager',
  }];
  const r = G.analyzeComments(comments);
  expect(r.ok).toBe(false);
  expect(r.violations.some(v => v.rule === 'signer-alias-not-registry-derived')).toBe(true);
});

test('fails on artifact-role mismatch', () => {
  const comments = [{
    body: '## MANAGER_HANDOFF\nSigned-by: Quill Mason\nTeam&Model: codex:gpt-5.4@codex-cli\nRole: consultant',
  }];
  const r = G.analyzeComments(comments);
  expect(r.ok).toBe(false);
  expect(r.violations.some(v => v.rule === 'artifact-role-mismatch')).toBe(true);
});

test('source-fixable role mismatch carries source-edit-first guidance', () => {
  const comments = [{
    body: [
      'role: collaborator',
      '## COLLABORATOR_HANDOFF',
      'Signed-by: Nova Mason',
      'Team&Model: codex:gpt-5.4@codex-cli',
      'Role: manager',
    ].join('\n'),
  }];
  const r = G.analyzeComments(comments);
  const v = r.violations.find(x => x.rule === 'artifact-role-mismatch');
  expect(v.remediation.mode).toBe('source-edit-first');
  expect(v.remediation.suggestedFix).toContain('Edit the offending issue comment');
});
