const test = require('node:test');
const assert = require('node:assert/strict');
const { injectGoalContext, shouldInject, buildPrefix, estimateOverheadTokens, PRIORITY_SENTENCE, DECISION_CHECK, GOAL_DEFINITIONS, expandKeywords } = require('../scripts/global/governance-context.js');

test('PRIORITY_SENTENCE contains all 10 goal labels', () => {
  for (let i = 1; i <= 10; i++) assert.match(PRIORITY_SENTENCE, new RegExp(`G${i}\\b`));
});

test('DECISION_CHECK mirrors goal_lens.py', () => {
  assert.match(DECISION_CHECK, /justify any lower-priority override/);
});

test('GOAL_DEFINITIONS has 10 entries G1-G10', () => {
  for (let i = 1; i <= 10; i++) assert.ok(GOAL_DEFINITIONS[`G${i}`], `G${i} missing`);
});

test('shouldInject: default true', () => {
  assert.equal(shouldInject({}), true);
});

test('shouldInject: tier=diagnostic skips', () => {
  assert.equal(shouldInject({ tier: 'diagnostic' }), false);
});

test('shouldInject: tier=test skips', () => {
  assert.equal(shouldInject({ tier: 'test' }), false);
});

test('shouldInject: explicit inject_goal_context=false skips', () => {
  assert.equal(shouldInject({ inject_goal_context: false }), false);
});

test('shouldInject: explicit inject_goal_context=true honors', () => {
  assert.equal(shouldInject({ inject_goal_context: true, tier: 'fleet-local' }), true);
});

test('shouldInject: null opts returns false', () => {
  assert.equal(shouldInject(null), false);
});

test('buildPrefix: default omits definitions', () => {
  const p = buildPrefix();
  assert.match(p, /G1 Governance/);
  assert.equal(p.includes('G1 Governance:'), false);  // definitions header
});

test('buildPrefix: includeDefinitions=true adds all 10 definitions', () => {
  const p = buildPrefix({ includeDefinitions: true });
  for (let i = 1; i <= 10; i++) assert.match(p, new RegExp(`G${i} `));
});

test('injectGoalContext: returns {systemPrefix, injected:true} when shouldInject', () => {
  const r = injectGoalContext({});
  assert.equal(r.injected, true);
  assert.ok(r.systemPrefix);
});

test('injectGoalContext: diagnostic tier returns null systemPrefix', () => {
  const r = injectGoalContext({ tier: 'diagnostic' });
  assert.equal(r.injected, false);
  assert.equal(r.systemPrefix, null);
});

test('estimateOverheadTokens: priority-only ~30 tokens', () => {
  assert.equal(estimateOverheadTokens(), 30);
});

test('estimateOverheadTokens: with definitions ~210 tokens', () => {
  assert.equal(estimateOverheadTokens({ includeDefinitions: true }), 210);
});

// --- P1-4 (#2231) expandKeywords + AC5 wiring ---

test('expandKeywords: AC1 positive match "cost" -> G3 def', () => {
  const r = expandKeywords('please reduce cost here');
  assert.deepEqual(r, [`G3 ${GOAL_DEFINITIONS.G3}`]);
});

test('expandKeywords: AC3 case-insensitive ("Privacy" matches G4)', () => {
  assert.deepEqual(expandKeywords('Privacy matters'), [`G4 ${GOAL_DEFINITIONS.G4}`]);
});

test('expandKeywords: AC3 word-boundary rejects "costume" (not G3)', () => {
  assert.deepEqual(expandKeywords('a nice costume party'), []);
});

test('expandKeywords: AC3 word-boundary rejects substring inside word', () => {
  // "governances" / "freelance" must not match governance / free
  assert.deepEqual(expandKeywords('freelance governances'), []);
});

test('expandKeywords: AC3 multi-goal returns multiple defs in G-order', () => {
  const r = expandKeywords('balance cost and privacy and resilience');
  assert.deepEqual(r, [`G3 ${GOAL_DEFINITIONS.G3}`, `G4 ${GOAL_DEFINITIONS.G4}`, `G6 ${GOAL_DEFINITIONS.G6}`]);
});

test('expandKeywords: AC3 dedup — two keywords mapping to same goal yield ONE entry', () => {
  // "resilience" and "fallback" both map to G6 -> single G6 entry
  assert.deepEqual(expandKeywords('resilience via fallback paths'), [`G6 ${GOAL_DEFINITIONS.G6}`]);
});

test('expandKeywords: AC3 no match -> empty array', () => {
  assert.deepEqual(expandKeywords('the quick brown fox'), []);
});

test('expandKeywords: AC3 empty / non-string -> empty array', () => {
  assert.deepEqual(expandKeywords(''), []);
  assert.deepEqual(expandKeywords(undefined), []);
  assert.deepEqual(expandKeywords(42), []);
});

test('expandKeywords: AC1 returns formatted "<key> <def>" strings', () => {
  const r = expandKeywords('observability');
  assert.equal(r.length, 1);
  assert.match(r[0], /^G8 Observability:/);
});

test('expandKeywords: AC3 each goal keyword set resolves to its own def', () => {
  for (const [key] of Object.entries(GOAL_DEFINITIONS)) {
    const word = require('../scripts/global/governance-context.js').GOAL_KEYWORDS[key][0];
    assert.deepEqual(expandKeywords(`x ${word} y`), [`${key} ${GOAL_DEFINITIONS[key]}`], `${key} via "${word}"`);
  }
});

test('injectGoalContext: AC5 appends matched defs AFTER priority/decision block, gated by expand_goal_keywords', () => {
  const base = injectGoalContext({ inject_goal_context: true });
  const expanded = injectGoalContext({ inject_goal_context: true, expand_goal_keywords: true, prompt: 'cut cost now' });
  // base (no expansion) must be a strict prefix of expanded (placement = append)
  assert.ok(expanded.systemPrefix.startsWith(base.systemPrefix), 'expanded must start with base block');
  assert.match(expanded.systemPrefix, new RegExp(`Goal context: G3 ${GOAL_DEFINITIONS.G3.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`));
  assert.deepEqual(expanded.expandedGoals, [`G3 ${GOAL_DEFINITIONS.G3}`]);
});

test('injectGoalContext: AC5 default off — no expansion without the opt', () => {
  const r = injectGoalContext({ inject_goal_context: true, prompt: 'cost privacy' });
  assert.deepEqual(r.expandedGoals, []);
  assert.equal(/Goal context:/.test(r.systemPrefix), false);
});

test('expandKeywords: regex-metachar prompt is safe + still word-matches (escape fix #2231)', () => {
  // metacharacters in the PROMPT must not throw and must not break boundary matching
  assert.deepEqual(expandKeywords('cost.* (privacy)'), [`G3 ${GOAL_DEFINITIONS.G3}`, `G4 ${GOAL_DEFINITIONS.G4}`]);
  assert.deepEqual(expandKeywords('a+b c?d'), []);
});
