'use strict';
// Tests for #2266: positive issue-only closeout evidence schema in consultant-closeout.js.
// Lane:no-code-remediation closeouts must explicitly declare N/A for PR, merge, CI, deploy.
// Strategy: tdd-pyramid (scripts/global/megalint validator) per test-methodology-matrix.
// node:test + node:assert — exercises the real blocking path, no mocks.

const test = require('node:test');
const assert = require('node:assert');
const {
  checkIssueOnlyEvidenceSchema,
  validate,
} = require('../scripts/global/megalint/consultant-closeout');

const NO_CODE = ['type:task', 'lane:no-code-remediation', 'status:review'];
const CODE_CHANGE = ['type:task', 'lane:code-change', 'status:review'];

// A closeout body that declares all four issue-only N/A surfaces.
function issueOnlyBody(overrides = '') {
  return [
    'CONSULTANT_CLOSEOUT',
    'verdict: approve_for_merge',
    'G1: 8 G2: 8 G3: 8 G4: 8 G5: 8 G6: 8 G7: 8 G8: 8 G9: 8',
    'verification-timestamp: 2026-06-26T12:00:00Z',
    'PR: N/A - no-code remediation lane',
    'merge-evidence: N/A - issue-only',
    'CI: N/A - no repository diff',
    'sync-verification: N/A - change does not touch deployed runtime targets',
    'Signed-by: Orla Vale',
    'Team&Model: claude-code:claude-opus-4-8@local',
    'Role: consultant',
    'anneal_tickets_filed: none',
    'mid_flight_flaws: none',
    overrides,
  ].join('\n');
}

const makeComments = body => [{ body }];

// ---------------------------------------------------------------------------
// Unit: checkIssueOnlyEvidenceSchema
// ---------------------------------------------------------------------------

test('AC1/AC2: no-code lane + all four N/A surfaces declared → no violations', () => {
  const viols = checkIssueOnlyEvidenceSchema(issueOnlyBody(), { labels: NO_CODE });
  assert.strictEqual(viols.length, 0, `unexpected: ${viols.map(v => v.rule).join(', ')}`);
});

test('AC2: no-code lane + missing CI N/A → one blocking violation', () => {
  const body = issueOnlyBody().replace(/CI: N\/A.*\n/, '');
  const viols = checkIssueOnlyEvidenceSchema(body, { labels: NO_CODE });
  const rules = viols.map(v => v.rule);
  assert.deepStrictEqual(rules, ['issue-only-ci-na-missing']);
  assert.strictEqual(viols[0].severity, undefined, 'must be hard-blocking by default');
});

test('AC2: no-code lane + zero N/A surfaces → all four surfaces flagged', () => {
  const viols = checkIssueOnlyEvidenceSchema('CONSULTANT_CLOSEOUT\nverdict: approve', { labels: NO_CODE });
  const rules = viols.map(v => v.rule).sort();
  assert.deepStrictEqual(rules, [
    'issue-only-ci-na-missing',
    'issue-only-deploy-na-missing',
    'issue-only-merge-na-missing',
    'issue-only-pr-na-missing',
  ]);
});

test('AC4: code-change lane → no issue-only requirement even with surfaces absent', () => {
  const viols = checkIssueOnlyEvidenceSchema('CONSULTANT_CLOSEOUT\nverdict: approve', { labels: CODE_CHANGE });
  assert.strictEqual(viols.length, 0, 'code-change lane must be untouched');
});

test('AC5 anti-forgery: label absent but body claims the lane → schema NOT applied', () => {
  // Detection is gated on the authoritative label, never on body text, so a closeout
  // that merely writes "lane: no-code-remediation" in prose cannot claim the reduced schema.
  const body = 'CONSULTANT_CLOSEOUT\nlane: lane:no-code-remediation\nverdict: approve';
  const viols = checkIssueOnlyEvidenceSchema(body, { labels: CODE_CHANGE });
  assert.strictEqual(viols.length, 0, 'body-claimed lane must not trigger the reduced schema');
});

test('alias forms accepted: pull-request / merge / checks / deploy-runtime-impact', () => {
  const body = [
    'pull-request: N/A',
    'merge: N/A',
    'checks: N/A',
    'deploy-runtime-impact: N/A',
  ].join('\n');
  const viols = checkIssueOnlyEvidenceSchema(body, { labels: NO_CODE });
  assert.strictEqual(viols.length, 0, `aliases should satisfy: ${viols.map(v => v.rule).join(', ')}`);
});

test('rollback: NO_CODE_EVIDENCE_SCHEMA_ADVISORY=1 demotes violations to advisory', () => {
  const prev = process.env.NO_CODE_EVIDENCE_SCHEMA_ADVISORY;
  process.env.NO_CODE_EVIDENCE_SCHEMA_ADVISORY = '1';
  try {
    const viols = checkIssueOnlyEvidenceSchema('CONSULTANT_CLOSEOUT', { labels: NO_CODE });
    assert.strictEqual(viols.length, 4);
    for (const v of viols) assert.strictEqual(v.severity, 'advisory');
  } finally {
    if (prev === undefined) delete process.env.NO_CODE_EVIDENCE_SCHEMA_ADVISORY;
    else process.env.NO_CODE_EVIDENCE_SCHEMA_ADVISORY = prev;
  }
});

test('non-string body / missing input → no throw, no false pass', () => {
  assert.doesNotThrow(() => checkIssueOnlyEvidenceSchema(null, { labels: NO_CODE }));
  assert.strictEqual(checkIssueOnlyEvidenceSchema(null, { labels: NO_CODE }).length, 4);
  assert.doesNotThrow(() => checkIssueOnlyEvidenceSchema('x', undefined));
  assert.strictEqual(checkIssueOnlyEvidenceSchema('x', undefined).length, 0);
});

// ---------------------------------------------------------------------------
// Integration: validate() end-to-end
// ---------------------------------------------------------------------------

test('AC1: validate() ok:true for complete issue-only closeout on no-code lane', () => {
  const result = validate({ comments: makeComments(issueOnlyBody()), labels: NO_CODE, lane: 'lane:no-code-remediation' });
  const hard = (result.violations || []).filter(v => v.severity !== 'advisory');
  assert.strictEqual(hard.length, 0, `unexpected hard violations: ${hard.map(v => v.rule).join(', ')}`);
  assert.strictEqual(result.ok, true);
});

test('AC1: validate() ok:false when no-code closeout omits a surface N/A', () => {
  const body = issueOnlyBody().replace(/merge-evidence: N\/A.*\n/, '');
  const result = validate({ comments: makeComments(body), labels: NO_CODE, lane: 'lane:no-code-remediation' });
  assert.strictEqual(result.ok, false);
  assert.ok((result.violations || []).some(v => v.rule === 'issue-only-merge-na-missing'));
});

test('AC3: verdict/rubric/flaw fields still required on the no-code lane', () => {
  // Drop the flaw fields but keep all four N/A surfaces — universal checks must still fail.
  const body = issueOnlyBody().replace(/anneal_tickets_filed: none\n/, '').replace(/mid_flight_flaws: none\n?/, '');
  const result = validate({ comments: makeComments(body), labels: NO_CODE, lane: 'lane:no-code-remediation' });
  assert.strictEqual(result.ok, false, 'flaw fields remain mandatory in the reduced lane');
  const rules = (result.violations || []).map(v => v.rule);
  assert.ok(rules.includes('missing-anneal-tickets-filed') || rules.includes('missing-mid-flight-flaws'));
});

test('AC4: validate() unaffected for code-change closeout missing N/A surfaces', () => {
  // Same body minus the N/A lines, but lane is code-change → no issue-only violations.
  const body = issueOnlyBody()
    .replace(/PR: N\/A.*\n/, '').replace(/merge-evidence: N\/A.*\n/, '')
    .replace(/CI: N\/A.*\n/, '').replace(/sync-verification: N\/A.*\n/, '');
  const result = validate({ comments: makeComments(body), labels: CODE_CHANGE, lane: 'lane:code-change', isEpic: false });
  const issueOnly = (result.violations || []).filter(v => v.rule.startsWith('issue-only-'));
  assert.strictEqual(issueOnly.length, 0, 'code-change lane must carry no issue-only violations');
});
