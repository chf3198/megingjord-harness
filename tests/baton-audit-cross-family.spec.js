// Refs #3293, Epic #3284 W5 — cross-family invariant tests (AC3)
// Validates that the audit enforces the cross-family non-Anthropic-reviewer
// invariant for ALL teams in the family registry.
const test = require('node:test');
const assert = require('node:assert/strict');
const {
  assertCrossFamily, teamToFamily, TEAM_FAMILY_MAP, KNOWN_FAMILIES,
} = require(
  '../scripts/global/baton-postmerge-audit/family-registry'
);
const { runPostMergeAudit } = require(
  '../scripts/global/baton-postmerge-audit/post-merge-auditor'
);

// -- assertCrossFamily unit tests --

test('AC3: claude-code author + non-Anthropic reviewer is cross-family', () => {
  assert.equal(assertCrossFamily('claude-code', 'qwen'), true);
  assert.equal(assertCrossFamily('claude-code', 'openai'), true);
  assert.equal(assertCrossFamily('claude-code', 'google'), true);
  assert.equal(assertCrossFamily('claude-code', 'meta'), true);
  assert.equal(assertCrossFamily('claude-code', 'mistral'), true);
});

test('AC3: claude-code author + anthropic reviewer is family violation', () => {
  assert.equal(assertCrossFamily('claude-code', 'anthropic'), false);
  assert.equal(assertCrossFamily('claude-code', 'Anthropic'), false);
});

test('AC3: copilot author + openai reviewer is family violation', () => {
  assert.equal(assertCrossFamily('copilot', 'openai'), false);
  assert.equal(assertCrossFamily('copilot', 'OpenAI'), false);
});

test('AC3: copilot author + non-openai reviewer is cross-family', () => {
  assert.equal(assertCrossFamily('copilot', 'anthropic'), true);
  assert.equal(assertCrossFamily('copilot', 'google'), true);
  assert.equal(assertCrossFamily('copilot', 'qwen'), true);
});

test('AC3: codex author + openai reviewer is family violation', () => {
  assert.equal(assertCrossFamily('codex', 'openai'), false);
});

test('AC3: codex author + non-openai reviewer is cross-family', () => {
  assert.equal(assertCrossFamily('codex', 'anthropic'), true);
  assert.equal(assertCrossFamily('codex', 'qwen'), true);
});

test('AC3: antigravity author + google reviewer is family violation', () => {
  assert.equal(assertCrossFamily('antigravity', 'google'), false);
});

test('AC3: antigravity author + non-google reviewer is cross-family', () => {
  assert.equal(assertCrossFamily('antigravity', 'anthropic'), true);
  assert.equal(assertCrossFamily('antigravity', 'openai'), true);
  assert.equal(assertCrossFamily('antigravity', 'qwen'), true);
});

test('AC3: cursor author + openai reviewer is family violation', () => {
  assert.equal(assertCrossFamily('cursor', 'openai'), false);
});

test('AC3: cursor author + non-openai reviewer is cross-family', () => {
  assert.equal(assertCrossFamily('cursor', 'anthropic'), true);
});

test('AC3: openclaw author + local reviewer is family violation', () => {
  assert.equal(assertCrossFamily('openclaw', 'local'), false);
});

test('AC3: openclaw author + non-local reviewer is cross-family', () => {
  assert.equal(assertCrossFamily('openclaw', 'anthropic'), true);
  assert.equal(assertCrossFamily('openclaw', 'openai'), true);
});

// -- teamToFamily unit tests --

test('teamToFamily maps all known teams', () => {
  for (const [team, family] of Object.entries(TEAM_FAMILY_MAP)) {
    assert.equal(teamToFamily(team), family,
      `teamToFamily("${team}") should return "${family}"`);
  }
});

test('teamToFamily returns null for unknown team', () => {
  assert.equal(teamToFamily('nonexistent'), null);
  assert.equal(teamToFamily(''), null);
  assert.equal(teamToFamily(null), null);
});

// -- assertCrossFamily error handling --

test('assertCrossFamily throws on missing authorTeam', () => {
  assert.throws(() => assertCrossFamily(null, 'qwen'),
    { message: /authorTeam is required/ });
  assert.throws(() => assertCrossFamily('', 'qwen'),
    { message: /authorTeam is required/ });
});

test('assertCrossFamily throws on missing reviewerFamily', () => {
  assert.throws(() => assertCrossFamily('claude-code', null),
    { message: /reviewerFamily is required/ });
  assert.throws(() => assertCrossFamily('claude-code', ''),
    { message: /reviewerFamily is required/ });
});

test('assertCrossFamily throws on unknown team', () => {
  assert.throws(() => assertCrossFamily('unknown-team', 'qwen'),
    { message: /unknown team/ });
});

// -- Integration: auditor rejects same-family reviewer --

test('AC3 integration: auditor returns FAMILY_VIOLATION for same-family', async () => {
  const dispatch = async () => ({
    verdict: 'ACCEPT', score: 10,
    reviewer_model_family: 'anthropic', findings: [],
  });
  const result = await runPostMergeAudit(
    { number: 50, title: 'test', diff: 'diff' },
    { dispatch, authorTeamModel: 'claude-code:opus@claude-code-cli' }
  );
  assert.equal(result.audit.verdict, 'FAMILY_VIOLATION');
  assert.equal(result.audit.familyViolation, true);
  assert.equal(result.mergeBlocking, false,
    'even family violations must not block merge');
});

test('AC3 integration: auditor accepts cross-family reviewer', async () => {
  const dispatch = async () => ({
    verdict: 'ACCEPT', score: 8,
    reviewer_model_family: 'qwen', findings: [],
  });
  const result = await runPostMergeAudit(
    { number: 51, title: 'test', diff: 'diff' },
    { dispatch, authorTeamModel: 'claude-code:sonnet@claude-code-cli' }
  );
  assert.equal(result.audit.verdict, 'ACCEPT');
  assert.equal(result.audit.familyViolation, false);
});

// -- All teams x all families matrix --

test('AC3 exhaustive: every team rejects own-family reviewer', () => {
  for (const [team, family] of Object.entries(TEAM_FAMILY_MAP)) {
    assert.equal(assertCrossFamily(team, family), false,
      `${team} author + ${family} reviewer should be a violation`);
  }
});

test('AC3 exhaustive: every team accepts other-family reviewers', () => {
  for (const [team, ownFamily] of Object.entries(TEAM_FAMILY_MAP)) {
    for (const otherFamily of KNOWN_FAMILIES) {
      if (otherFamily === ownFamily) continue;
      assert.equal(assertCrossFamily(team, otherFamily), true,
        `${team} author + ${otherFamily} reviewer should be cross-family`);
    }
  }
});
