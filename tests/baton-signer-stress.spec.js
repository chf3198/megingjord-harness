const { test, expect } = require('@playwright/test');
const path = require('path');
const { buildBatonComment } = require(path.resolve(__dirname, '..', 'scripts', 'global', 'baton-comment-build.js'));
const G = require(path.resolve(__dirname, '..', 'scripts', 'global', 'baton-artifact-governance.js'));

const ROLES = [
  ['MANAGER_HANDOFF', 'manager', 'copilot:gpt-5.3-codex@github-copilot'],
  ['COLLABORATOR_HANDOFF', 'collaborator', 'codex:gpt-5.4@codex-cli'],
  ['ADMIN_HANDOFF', 'admin', 'claude-code:opus-4-7@claude-code-cli'],
  ['CONSULTANT_CLOSEOUT', 'consultant', 'openclaw:qwen2.5-coder:7b@openclaw-gateway/windows-laptop'],
];

test('stress: 100 sequential baton transitions have zero signer drift', () => {
  const comments = [];
  for (let i = 0; i < 100; i++) {
    for (const [artifact, role, teamModel] of ROLES) {
      comments.push({ body: buildBatonComment({ artifact, role, teamModel, ticket: `${2000 + i}` }) });
    }
  }
  const r = G.analyzeComments(comments);
  expect(r.ok).toBe(true);
  expect(r.count).toBe(400);
});

test('stress: 20 parallel synthetic tickets keep signer/role integrity', async () => {
  const parallel = Array.from({ length: 20 }, (_, idx) => new Promise(resolve => {
    setTimeout(() => {
      const comments = ROLES.map(([artifact, role, teamModel]) => ({
        body: buildBatonComment({ artifact, role, teamModel, ticket: `${3000 + idx}` }),
      }));
      resolve(comments);
    }, Math.floor(Math.random() * 8));
  }));
  const allComments = (await Promise.all(parallel)).flat();
  const r = G.analyzeComments(allComments);
  expect(r.ok).toBe(true);
  expect(r.count).toBe(80);
});
