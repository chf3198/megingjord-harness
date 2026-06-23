// C2 (#3030): analyzeComments validates last-of-each-type, not all.
// Superseded bad artifacts become advisory, not blocking.
const { test, expect } = require('@playwright/test');
const path = require('path');
const G = require(path.resolve(
  __dirname, '..', 'scripts', 'global', 'baton-artifact-governance.js'
));
const { buildBatonComment } = require(path.resolve(
  __dirname, '..', 'scripts', 'global', 'baton-comment-build.js'
));

function mk(artifact, role, teamModel) {
  return {
    body: buildBatonComment({
      artifact, role, teamModel, ticket: 3030,
    }),
  };
}

test('superseded bad artifact does not block (#3030 AC1)', () => {
  const badManager = {
    body: '## MANAGER_HANDOFF\nSigned-by: WRONG\n'
      + 'Team&Model: codex:gpt-5.4@codex-cli\nRole: manager',
  };
  const goodManager = mk(
    'MANAGER_HANDOFF', 'manager', 'codex:gpt-5.4@codex-cli'
  );
  const r = G.analyzeComments([badManager, goodManager]);
  expect(r.ok).toBe(true);
  expect(r.advisories.length).toBeGreaterThan(0);
  expect(r.advisories[0].severity).toBe('advisory');
  expect(r.advisories[0].detail).toContain('[superseded]');
});

test('last-of-type is validated, not first (#3030 AC1)', () => {
  const goodFirst = mk(
    'MANAGER_HANDOFF', 'manager', 'codex:gpt-5.4@codex-cli'
  );
  const badLast = {
    body: '## MANAGER_HANDOFF\nSigned-by: WRONG\n'
      + 'Team&Model: codex:gpt-5.4@codex-cli\nRole: manager',
  };
  const r = G.analyzeComments([goodFirst, badLast]);
  expect(r.ok).toBe(false);
  expect(r.advisories).toEqual([]);
});

test('entries carry positionIndex (#3030 AC3 freshness)', () => {
  const comments = [
    mk('MANAGER_HANDOFF', 'manager', 'codex:gpt-5.4@codex-cli'),
    { body: 'some non-artifact comment' },
    mk('ADMIN_HANDOFF', 'admin', 'codex:gpt-5.4@codex-cli'),
  ];
  const es = G.entries(comments);
  expect(es[0].positionIndex).toBe(0);
  expect(es[1].positionIndex).toBe(2);
});

test('latestOfEachType picks last per artifact', () => {
  const all = [
    { artifact: 'MANAGER_HANDOFF', positionIndex: 0 },
    { artifact: 'MANAGER_HANDOFF', positionIndex: 3 },
    { artifact: 'ADMIN_HANDOFF', positionIndex: 1 },
  ];
  const { latest, superseded } = G.latestOfEachType(all);
  expect(latest.length).toBe(2);
  expect(latest.find(e => e.artifact === 'MANAGER_HANDOFF').positionIndex)
    .toBe(3);
  expect(superseded.length).toBe(1);
  expect(superseded[0].positionIndex).toBe(0);
});

test('count reflects total (not just latest)', () => {
  const dup = mk(
    'MANAGER_HANDOFF', 'manager', 'codex:gpt-5.4@codex-cli'
  );
  const r = G.analyzeComments([dup, dup]);
  expect(r.count).toBe(2);
  expect(r.ok).toBe(true);
});

test('mixed: latest valid + superseded invalid = ok', () => {
  const bad = {
    body: '## COLLABORATOR_HANDOFF\nSigned-by: X\n'
      + 'Team&Model: codex:gpt-5.4@codex-cli\nRole: collaborator',
  };
  const good = mk(
    'COLLABORATOR_HANDOFF', 'collaborator', 'codex:gpt-5.4@codex-cli'
  );
  const mgr = mk(
    'MANAGER_HANDOFF', 'manager', 'codex:gpt-5.4@codex-cli'
  );
  const r = G.analyzeComments([bad, mgr, good]);
  expect(r.ok).toBe(true);
  expect(r.advisories.length).toBeGreaterThan(0);
});
