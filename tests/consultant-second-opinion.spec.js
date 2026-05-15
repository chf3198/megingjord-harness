// Unit tests for scripts/global/consultant-second-opinion.js (Epic #1568 AC-4, #1573).
// Helper pins the second-opinion contract: parse a CONSULTANT_CLOSEOUT body into
// a G1-G9 score map, compare against a second rater's map, decide on Tier-3
// escalation when any goal's |delta| > 1.0, and format a SECOND_OPINION block.
const { test, expect } = require('@playwright/test');
const path = require('path');
const SO = require(path.resolve(__dirname, '..', 'scripts', 'global', 'consultant-second-opinion.js'));

test('parseCloseoutScores extracts the standard "G1=10, G2=9, ..." inline form', () => {
  const body = 'G1=10, G2=9, G3=10, G4=10, G5=10, G6=8, G7=9, G8=9, G9=10. Mean=9.4.';
  expect(SO.parseCloseoutScores(body)).toEqual({
    G1: 10, G2: 9, G3: 10, G4: 10, G5: 10, G6: 8, G7: 9, G8: 9, G9: 10,
  });
});

test('parseCloseoutScores tolerates colon-separated scores (G1: 10) and decimals', () => {
  expect(SO.parseCloseoutScores('G1: 9.4 G2: 8 G3: 7.5')).toEqual({ G1: 9.4, G2: 8, G3: 7.5 });
});

test('parseCloseoutScores returns empty object on null, empty, or no-score body', () => {
  expect(SO.parseCloseoutScores('')).toEqual({});
  expect(SO.parseCloseoutScores(null)).toEqual({});
  expect(SO.parseCloseoutScores('this body has no per-goal scores at all')).toEqual({});
});

test('parseRaterTeamModel extracts the Team&Model literal from a rater output body', () => {
  expect(SO.parseRaterTeamModel('Signed-by: Gemma Vale\nTeam&Model: fleet:gemma3:1b@ollama\nRole: consultant'))
    .toBe('fleet:gemma3:1b@ollama');
});

test('parseRaterTeamModel returns null when Team&Model field absent', () => {
  expect(SO.parseRaterTeamModel('rater output without team-model field')).toBeNull();
  expect(SO.parseRaterTeamModel(null)).toBeNull();
});

test('isCrossProviderRater true when provider prefixes differ; false on identical provider', () => {
  expect(SO.isCrossProviderRater('claude-code:opus-4-7@anthropic', 'fleet:gemma3:1b@ollama')).toBe(true);
  expect(SO.isCrossProviderRater('claude-code:opus-4-7@anthropic', 'claude-code:sonnet-4-6@anthropic')).toBe(false);
  expect(SO.isCrossProviderRater('copilot:gpt-5.3-codex@github', 'codex:gpt-5.3-codex@openai')).toBe(true);
});

test('isCrossProviderRater false when either side is null or empty', () => {
  expect(SO.isCrossProviderRater(null, 'fleet:gemma3:1b@ollama')).toBe(false);
  expect(SO.isCrossProviderRater('claude-code:opus-4-7@anthropic', '')).toBe(false);
});

test('computeDeltas yields signed per-goal deltas and max-abs across the union of goals', () => {
  const first = { G1: 10, G2: 8, G5: 6 };
  const second = { G1: 9, G2: 9, G5: 8 };
  const result = SO.computeDeltas(first, second);
  expect(result.deltas).toEqual({ G1: -1, G2: 1, G5: 2 });
  expect(result.max_abs_delta).toBe(2);
});

test('computeDeltas skips goals where either rater lacks a score', () => {
  const first = { G1: 10, G2: 8 };
  const second = { G2: 9, G5: 7 };
  const result = SO.computeDeltas(first, second);
  expect(result.deltas).toEqual({ G2: 1 });
  expect(result.max_abs_delta).toBe(1);
});

test('computeDeltas tolerates empty inputs', () => {
  expect(SO.computeDeltas({}, {})).toEqual({ deltas: {}, max_abs_delta: 0 });
  expect(SO.computeDeltas(null, null)).toEqual({ deltas: {}, max_abs_delta: 0 });
});

test('shouldEscalateTier3 fires when max_abs_delta > 1.0; not at exactly 1.0', () => {
  expect(SO.shouldEscalateTier3(1.5)).toBe(true);
  expect(SO.shouldEscalateTier3(1.0)).toBe(false);
  expect(SO.shouldEscalateTier3(0.5)).toBe(false);
  expect(SO.shouldEscalateTier3(NaN)).toBe(false);
});

test('appendSecondOpinionBlock formats the canonical SECOND_OPINION block', () => {
  const block = SO.appendSecondOpinionBlock({
    rater_team_model: 'fleet:gemma3:1b@ollama',
    second_scores: { G1: 9, G2: 8 },
    deltas: { G1: -1, G2: 0 },
    max_abs_delta: 1,
    escalate: false,
  });
  expect(block).toContain('SECOND_OPINION');
  expect(block).toContain('rater_team_model: fleet:gemma3:1b@ollama');
  expect(block).toContain('scores: G1=9,G2=8');
  expect(block).toContain('deltas: G1=-1,G2=0');
  expect(block).toContain('verdict: NO_ESCALATION');
});

test('appendSecondOpinionBlock emits ESCALATE_TIER_3 verdict when escalate flag set', () => {
  const block = SO.appendSecondOpinionBlock({
    rater_team_model: 'fleet:gemma3:1b@ollama',
    second_scores: { G5: 4 }, deltas: { G5: -2 }, max_abs_delta: 2, escalate: true,
  });
  expect(block).toContain('verdict: ESCALATE_TIER_3');
});

test('shouldSkip returns the waiver-reason when override label present, null otherwise', () => {
  expect(SO.shouldSkip(['second-opinion:waived'])).toBe('override-waived');
  expect(SO.shouldSkip([])).toBeNull();
  expect(SO.shouldSkip(null)).toBeNull();
});

test('end-to-end: parse, cross-provider check, compute, escalate, format', () => {
  const firstBody = 'G1=10 G2=8 G3=9\nSigned-by: Orla Vale\nTeam&Model: claude-code:opus-4-7@anthropic';
  const secondBody = 'G1=8 G2=9 G3=4\nSigned-by: Gemma Vale\nTeam&Model: fleet:gemma3:1b@ollama';
  const first = SO.parseCloseoutScores(firstBody);
  const second = SO.parseCloseoutScores(secondBody);
  const firstRater = SO.parseRaterTeamModel(firstBody);
  const secondRater = SO.parseRaterTeamModel(secondBody);
  expect(SO.isCrossProviderRater(firstRater, secondRater)).toBe(true);
  const { deltas, max_abs_delta } = SO.computeDeltas(first, second);
  expect(max_abs_delta).toBe(5);
  expect(SO.shouldEscalateTier3(max_abs_delta)).toBe(true);
  const block = SO.appendSecondOpinionBlock({
    rater_team_model: secondRater, second_scores: second, deltas, max_abs_delta, escalate: true,
  });
  expect(block).toContain('verdict: ESCALATE_TIER_3');
});
