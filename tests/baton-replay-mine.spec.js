// Unit tests for the replay-corpus miner (Epic #2037 follow-on, Refs #2692).
// Covers: exact round-trip (build -> parse -> rebuild byte-identical) across artifact
// types incl. block fields with internal blank lines, non-artifact rejection, the
// trailing-newline transport normalization, and that the committed real corpus
// reproduces at/above the promotion gate.
const { test, expect } = require('@playwright/test');
const { parseArtifact, mineCorpus } = require('../scripts/global/baton-replay-mine');
const { buildArtifact } = require('../scripts/global/baton-artifact-builder');
const { replayEval, meetsGate } = require('../scripts/global/baton-replay-eval');
const corpus = require('../tests/fixtures/baton-replay/corpus.json');

const TM = 'claude-code:opus@anthropic';

const ROUND_TRIP_CASES = [
  { artifact: 'MANAGER_HANDOFF', role: 'manager', teamModel: TM, ticket: 2692, fields: { scope: 'a\nb\n\nc', lane: 'lane:code-change', test_strategy: 'tdd-pyramid', acceptance: '- AC1\n- AC2', gates: 'lint', related_tickets: 'none', overlap_decision: 'no-overlap' } },
  { artifact: 'ADMIN_HANDOFF', role: 'admin', teamModel: TM, ticket: 2692, fields: { branch: 'feat/2692-x', commit: 'abc1234', 'signer-independence-check': 'PASS', 'deploy-runtime-impact': 'line one\n\nline two after blank' } },
  { artifact: 'CONSULTANT_CLOSEOUT', role: 'consultant', teamModel: TM, ticket: 2692, fields: { status: 'review', verdict: 'approve_for_merge', 'verification-timestamp': '2026-06-06T00:00:00Z', rubric_rating: '9/10', anneal_tickets_filed: 'none', mid_flight_flaws: '- one\n- two' } },
];

for (const input of ROUND_TRIP_CASES) {
  test(`${input.artifact} round-trips build -> parse -> rebuild byte-identical`, () => {
    const built = buildArtifact(input);
    const parsed = parseArtifact(built);
    expect(parsed.artifact).toBe(input.artifact);
    expect(parsed.role).toBe(input.role);
    expect(buildArtifact(parsed)).toBe(built);
  });
}

test('parseArtifact returns null for non-artifact text', () => {
  expect(parseArtifact('just a normal comment, no header')).toBeNull();
  expect(parseArtifact('## NOT_AN_ARTIFACT\n\nx\n\nSigned-by: a\nTeam&Model: b\nRole: manager')).toBeNull();
});

test('mineCorpus skips non-artifacts and strips the transport trailing newline', () => {
  const built = buildArtifact(ROUND_TRIP_CASES[1]);
  const mined = mineCorpus(['noise', `${built}\n`, 'more noise']); // GitHub appends \n
  expect(mined).toHaveLength(1);
  expect(mined[0].expected).toBe(built); // trailing newline stripped -> matches builder
  expect(buildArtifact(mined[0].input)).toBe(mined[0].expected);
});

test('committed real-artifact corpus reproduces at or above the gate', () => {
  const result = replayEval(corpus);
  expect(result.total).toBeGreaterThanOrEqual(10);
  expect(meetsGate(result.rate)).toBe(true);
});
