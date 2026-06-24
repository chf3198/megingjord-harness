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

test('fails on duplicate Role fields as mixed semantic-role misuse', () => {
  const comments = [{
    body: [
      '## MANAGER_HANDOFF',
      'Signed-by: Orla Mason',
      'Team&Model: codex:gpt-5.4@codex-cli',
      'Role: manager',
      'Role: collaborator',
    ].join('\n'),
  }];
  const r = G.analyzeComments(comments);
  expect(r.ok).toBe(false);
  expect(r.violations.some(v => v.rule === 'mixed-semantic-role-fields')).toBe(true);
});

test('fails on duplicate Role fields without signer metadata', () => {
  const comments = [{ body: '## MANAGER_HANDOFF\nRole: manager\nRole: collaborator' }];
  const r = G.analyzeComments(comments);
  expect(r.ok).toBe(false);
  expect(r.violations.some(v => v.rule === 'mixed-semantic-role-fields')).toBe(true);
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

// #2564 — entries() classifies by line-anchored header, not bare substring.
// A valid artifact that merely mentions sibling tokens in prose must NOT be
// misclassified as those siblings (which would trip a false artifact-role-mismatch).
test('prose mention of sibling artifact tokens does not misclassify (#2564)', () => {
  const comments = [{
    body: buildBatonComment({
      artifact: 'MANAGER_HANDOFF', role: 'manager', teamModel: 'codex:gpt-5.4@codex-cli', ticket: 2564,
      summary: 'Note: the COLLABORATOR_HANDOFF and ADMIN_HANDOFF will follow once work starts.',
    }),
  }];
  const r = G.analyzeComments(comments);
  expect(r.count).toBe(1); // only MANAGER_HANDOFF, not the two prose-mentioned siblings
  expect(r.ok).toBe(true);
  expect(r.violations.some(v => v.rule === 'artifact-role-mismatch')).toBe(false);
});

test('real ## header is still classified — no false negative (#2564)', () => {
  const comments = [{
    body: buildBatonComment({
      artifact: 'CONSULTANT_CLOSEOUT', role: 'consultant', teamModel: 'codex:gpt-5.4@codex-cli', ticket: 2564,
      summary: 'Verified; the COLLABORATOR_HANDOFF was posted earlier in the thread.',
    }),
  }];
  const r = G.analyzeComments(comments);
  expect(r.count).toBe(1); // CONSULTANT_CLOSEOUT header classified; prose mention ignored
  expect(r.ok).toBe(true);
});

test('last-of-type: stale bad MANAGER_HANDOFF does not block when newer valid one exists (#3030)', () => {
  const comments = [
    { body: '## MANAGER_HANDOFF\nSigned-by: Curtis Franks\nTeam&Model: codex:gpt-5.4@codex-cli\nRole: manager' },
    mk('MANAGER_HANDOFF', 'manager', 'codex:gpt-5.4@codex-cli'),
  ];
  const r = G.analyzeComments(comments);
  expect(r.ok).toBe(true);
  expect(r.advisories?.length).toBeGreaterThan(0);
});

test('MANAGER_HANDOFF_SUPERSEDED is ignored (#3030)', () => {
  const comments = [
    { body: '## MANAGER_HANDOFF_SUPERSEDED\nSigned-by: Curtis Franks\nTeam&Model: codex:gpt-5.4@codex-cli\nRole: manager' },
    mk('MANAGER_HANDOFF', 'manager', 'codex:gpt-5.4@codex-cli'),
  ];
  expect(G.analyzeComments(comments).ok).toBe(true);
});
