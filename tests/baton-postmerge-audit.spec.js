// Refs #3293, Epic #3284 W5 — post-merge consultant audit tests
// Validates: AC1 (post-merge, no merge-blocking), AC2 (Tier-3 escalation
// on failing audit), and the eval-harness fixtures.
const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const { runPostMergeAudit } = require(
  '../scripts/global/baton-postmerge-audit/post-merge-auditor'
);
const { escalateOnAuditFailure, shouldEscalate, AUDIT_FAIL_THRESHOLD } = require(
  '../scripts/global/baton-postmerge-audit/tier3-escalation'
);

// Load eval fixtures
const fixtures = require(
  './eval/baton-postmerge-audit/fixtures.json'
).fixtures;

// -- Helpers --

function fakeDispatch(result) {
  return async () => result;
}

function fakeGhClient() {
  const created = [];
  return {
    createIssue: async (params) => {
      const issue = { number: 9000 + created.length, url: 'https://fake' };
      created.push({ ...params, ...issue });
      return issue;
    },
    created,
  };
}

// -- AC1: Post-merge advisory, NEVER merge-blocking --

test('AC1: passing audit returns mergeBlocking=false', async () => {
  const dispatch = fakeDispatch({
    verdict: 'ACCEPT', score: 8,
    reviewer_model_family: 'qwen', findings: [],
  });
  const result = await runPostMergeAudit(
    { number: 1, title: 'test', diff: 'x' },
    { dispatch, authorTeamModel: 'claude-code:opus@claude-code-cli' }
  );
  assert.equal(result.mergeBlocking, false);
  assert.equal(result.audit.verdict, 'ACCEPT');
});

test('AC1: failing audit still returns mergeBlocking=false', async () => {
  const dispatch = fakeDispatch({
    verdict: 'REJECT', score: 2,
    reviewer_model_family: 'qwen', findings: ['flaw found'],
  });
  const ghClient = fakeGhClient();
  const result = await runPostMergeAudit(
    { number: 2, title: 'bad', diff: 'y' },
    { dispatch, ghClient, authorTeamModel: 'claude-code:sonnet@claude-code-cli' }
  );
  assert.equal(result.mergeBlocking, false,
    'post-merge audit must NEVER return mergeBlocking=true');
});

test('AC1: family violation still returns mergeBlocking=false', async () => {
  const dispatch = fakeDispatch({
    verdict: 'ACCEPT', score: 9,
    reviewer_model_family: 'anthropic', findings: [],
  });
  const result = await runPostMergeAudit(
    { number: 3, title: 'same-family', diff: 'z' },
    { dispatch, authorTeamModel: 'claude-code:opus@claude-code-cli' }
  );
  assert.equal(result.mergeBlocking, false);
  assert.equal(result.audit.familyViolation, true);
});

// -- AC2: Failing audit opens Tier-3 ticket --

test('AC2: REJECT verdict triggers escalation via ghClient', async () => {
  const dispatch = fakeDispatch({
    verdict: 'REJECT', score: 3,
    reviewer_model_family: 'google', findings: ['auth bypass'],
  });
  const ghClient = fakeGhClient();
  const result = await runPostMergeAudit(
    { number: 10, title: 'auth fix', diff: 'diff' },
    { dispatch, ghClient, authorTeamModel: 'claude-code:opus@claude-code-cli' }
  );
  assert.equal(result.escalation.escalated, true);
  assert.equal(ghClient.created.length, 1);
  const ticket = ghClient.created[0];
  assert.ok(ticket.title.includes('Tier-3'));
  assert.ok(ticket.title.includes('#10'));
  assert.ok(ticket.body.includes('auth bypass'));
  assert.deepEqual(ticket.labels, [
    'type:bug', 'priority:P2', 'area:governance',
    'lane:code-change', 'anneal:tier-3',
  ]);
});

test('AC2: low score (below threshold) triggers escalation', async () => {
  const dispatch = fakeDispatch({
    verdict: 'PARTIAL', score: 2,
    reviewer_model_family: 'qwen', findings: ['incomplete tests'],
  });
  const ghClient = fakeGhClient();
  const result = await runPostMergeAudit(
    { number: 11, title: 'tests', diff: 'diff' },
    { dispatch, ghClient, authorTeamModel: 'codex:gpt-5@codex-cli' }
  );
  assert.equal(result.escalation.escalated, true);
  assert.equal(ghClient.created.length, 1);
});

test('AC2: passing audit does NOT escalate', async () => {
  const dispatch = fakeDispatch({
    verdict: 'ACCEPT', score: 9,
    reviewer_model_family: 'qwen', findings: [],
  });
  const ghClient = fakeGhClient();
  const result = await runPostMergeAudit(
    { number: 12, title: 'good', diff: 'diff' },
    { dispatch, ghClient, authorTeamModel: 'claude-code:opus@claude-code-cli' }
  );
  assert.equal(result.escalation, null);
  assert.equal(ghClient.created.length, 0);
});

// -- shouldEscalate unit tests --

test('shouldEscalate: REJECT verdict returns true', () => {
  assert.equal(shouldEscalate({ verdict: 'REJECT', score: 7 }), true);
});

test('shouldEscalate: low score returns true', () => {
  assert.equal(shouldEscalate({ verdict: 'PARTIAL', score: 2 }), true);
});

test('shouldEscalate: passing audit returns false', () => {
  assert.equal(shouldEscalate({ verdict: 'ACCEPT', score: 8 }), false);
});

test('shouldEscalate: null input returns false', () => {
  assert.equal(shouldEscalate(null), false);
});

test('shouldEscalate: score exactly at threshold returns false', () => {
  assert.equal(
    shouldEscalate({ verdict: 'ACCEPT', score: AUDIT_FAIL_THRESHOLD }),
    false
  );
});

// -- Eval fixture-driven tests --

test('eval fixtures: all produce expected verdicts and mergeBlocking=false', async () => {
  for (const fixture of fixtures) {
    const ghClient = fakeGhClient();
    const dispatch = fakeDispatch(fixture.input.dispatchResult);
    const result = await runPostMergeAudit(
      fixture.input.mergedPr,
      {
        dispatch,
        ghClient,
        authorTeamModel: fixture.input.authorTeamModel,
      }
    );
    assert.equal(result.mergeBlocking, false,
      `fixture ${fixture.id}: mergeBlocking must be false`);
    assert.equal(result.audit.verdict, fixture.expected.verdict,
      `fixture ${fixture.id}: verdict mismatch`);
    if (fixture.expected.escalated != null) {
      const didEscalate = result.escalation
        ? result.escalation.escalated : false;
      assert.equal(didEscalate, fixture.expected.escalated,
        `fixture ${fixture.id}: escalation mismatch`);
    }
    if (fixture.expected.familyViolation != null) {
      assert.equal(result.audit.familyViolation,
        fixture.expected.familyViolation,
        `fixture ${fixture.id}: familyViolation mismatch`);
    }
  }
});

// -- Error handling --

test('runPostMergeAudit throws on missing dispatch', async () => {
  await assert.rejects(
    () => runPostMergeAudit({ number: 1 }, {}),
    { message: /dispatch is required/ }
  );
});

test('runPostMergeAudit throws on missing mergedPr', async () => {
  await assert.rejects(
    () => runPostMergeAudit(null, { dispatch: async () => ({}) }),
    { message: /mergedPr is required/ }
  );
});
