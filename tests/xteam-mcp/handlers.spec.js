const test = require('node:test');
const assert = require('node:assert');
const path = require('node:path');
const { TEAM_NAMESPACE, VALID_TEAMS, leadLabel, parseExistingLeads, attemptClaim } =
  require('../../scripts/xteam-mcp/leader-election');
const { handleXteam, handleXteamStatus, leadPrompt, participantPrompt, loadPerspectives } =
  require('../../scripts/xteam-mcp/handlers');

const PERSPECTIVES = path.resolve(__dirname, '..', '..', 'inventory', 'team-perspectives.json');

function mockGhClient(initialLabels = []) {
  const state = { labels: [...initialLabels], created: [] };
  return {
    state,
    async viewLabels() { return state.labels.map(name => ({ name })); },
    async addLabel(_t, label) { state.labels.push(label); },
    async removeLabel(_t, label) { state.labels = state.labels.filter(l => l !== label); },
    async createEpic({ title, body, labels }) {
      const number = 9000 + state.created.length;
      state.created.push({ number, title, body, labels });
      return { number, url: `https://example.com/${number}` };
    },
  };
}

test('leader-election: leadLabel namespaces team correctly', () => {
  assert.strictEqual(leadLabel('claude-code'), 'xteam-lead:claude-code');
  assert.strictEqual(leadLabel('codex'), 'xteam-lead:codex');
});

test('leader-election: leadLabel rejects unknown team', () => {
  assert.throws(() => leadLabel('unknown'), /unknown team/);
});

test('leader-election: parseExistingLeads extracts team from xteam-lead labels', () => {
  const labels = [{ name: 'status:in-progress' }, { name: 'xteam-lead:codex' }];
  assert.deepStrictEqual(parseExistingLeads(labels), ['codex']);
});

test('leader-election: attemptClaim wins when no existing lead', async () => {
  const gh = mockGhClient([]);
  const result = await attemptClaim({ ticket: 100, team: 'claude-code', ghClient: gh });
  assert.strictEqual(result.role, 'lead');
  assert.strictEqual(result.leadTeam, 'claude-code');
  assert.ok(gh.state.labels.includes('xteam-lead:claude-code'));
});

test('leader-election: attemptClaim yields when lead already claimed', async () => {
  const gh = mockGhClient(['xteam-lead:codex']);
  const result = await attemptClaim({ ticket: 100, team: 'claude-code', ghClient: gh });
  assert.strictEqual(result.role, 'participant');
  assert.strictEqual(result.leadTeam, 'codex');
});

test('leader-election: attemptClaim rejects non-positive ticket', async () => {
  const gh = mockGhClient([]);
  await assert.rejects(() => attemptClaim({ ticket: 0, team: 'claude-code', ghClient: gh }),
    /positive integer/);
});

test('handlers: loadPerspectives returns 4 teams', () => {
  const teams = loadPerspectives(PERSPECTIVES);
  assert.ok(teams['claude-code']);
  assert.ok(teams['codex']);
  assert.ok(teams['copilot']);
  assert.ok(teams['antigravity']);
});

test('handlers: leadPrompt includes team perspective + ticket', () => {
  const perspective = { lens: 'L', strengths: ['s1', 's2'] };
  const prompt = leadPrompt({ team: 'codex', ticket: 42, perspective });
  assert.match(prompt, /LEAD on Epic #42/);
  assert.match(prompt, /Your perspective: L/);
  assert.match(prompt, /artifacts\/codex-rd\.md/);
});

test('handlers: participantPrompt mentions lead team', () => {
  const perspective = { lens: 'L', strengths: ['s'] };
  const prompt = participantPrompt({ team: 'copilot', ticket: 42, perspective, leadTeam: 'codex' });
  assert.match(prompt, /PARTICIPANT on Epic #42/);
  assert.match(prompt, /Lead is codex/);
});

test('handlers: handleXteam returns lead role on fresh Epic', async () => {
  const gh = mockGhClient([]);
  const result = await handleXteam({
    ticket: 100, team: 'claude-code',
    perspectivesPath: PERSPECTIVES, ghClient: gh, fs: require('fs'),
  });
  assert.strictEqual(result.role, 'lead');
  assert.match(result.prompt, /LEAD on Epic #100/);
});

test('handlers: handleXteam returns participant role on claimed Epic', async () => {
  const gh = mockGhClient(['xteam-lead:codex']);
  const result = await handleXteam({
    ticket: 100, team: 'claude-code',
    perspectivesPath: PERSPECTIVES, ghClient: gh, fs: require('fs'),
  });
  assert.strictEqual(result.role, 'participant');
  assert.match(result.prompt, /Lead is codex/);
});

test('handlers: handleXteamStatus reports no claim when empty', async () => {
  const gh = mockGhClient([]);
  const result = await handleXteamStatus({ ticket: 100, ghClient: gh });
  assert.strictEqual(result.status, 'no-claim');
  assert.strictEqual(result.leadTeam, null);
});

test('handlers: handleXteamStatus reports in-flight when lead claimed', async () => {
  const gh = mockGhClient(['xteam-lead:antigravity']);
  const result = await handleXteamStatus({ ticket: 100, ghClient: gh });
  assert.strictEqual(result.status, 'in-flight');
  assert.strictEqual(result.leadTeam, 'antigravity');
});
