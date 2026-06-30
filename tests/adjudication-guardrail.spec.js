// tdd-pyramid unit suite for the cross-model adjudication guardrail primitive (#3401, Epic #3392).
const test = require('node:test');
const assert = require('node:assert');
const G = require('../scripts/global/adjudication-guardrail');

// Build a deterministic, parseable panelist response for the given per-option scores.
function panelText(scores, pick) {
  const lines = scores.map((s, i) => `SCORE ${i + 1}: ${s.score} MINGOAL ${s.minGoal} :: rationale`);
  lines.push(`PICK ${pick}`);
  return lines.join('\n');
}

test('classifyDecision routes design/UAT to human-carveout', () => {
  const r = G.classifyDecision({ question: 'What brand color for the header?' });
  assert.equal(r.route, 'human-carveout');
  assert.equal(r.tier, 'design-uat');
});

test('classifyDecision routes irreversible action to human-carveout', () => {
  const r = G.classifyDecision({ question: 'Should I permanently delete the production database?' });
  assert.equal(r.route, 'human-carveout');
  assert.equal(r.tier, 'irreversible');
});

test('classifyDecision routes security-weakening to human-carveout (anti-goal)', () => {
  const r = G.classifyDecision({ question: 'Should we disable the merge protection guard to ship faster?' });
  assert.equal(r.route, 'human-carveout');
  assert.equal(r.tier, 'security-weakening');
});

test('classifyDecision self-resolves trivial decisions (no panel, G3)', () => {
  const r = G.classifyDecision({ question: 'Fix a typo in the comment' });
  assert.equal(r.route, 'self-resolve');
  assert.equal(r.tier, 'trivial');
});

test('classifyDecision adjudicates genuine multi-option decisions', () => {
  const r = G.classifyDecision({ question: 'Which retry backoff?', options: ['exponential', 'linear'] });
  assert.equal(r.route, 'adjudicate');
});

test('classifyDecision self-resolves a single non-trivial question with no options', () => {
  const r = G.classifyDecision({ question: 'Rename helper to resolveTicket' });
  assert.equal(r.route, 'self-resolve');
});

test('median handles even and odd lengths', () => {
  assert.equal(G.median([1, 2, 3]), 2);
  assert.equal(G.median([1, 2, 3, 4]), 2.5);
  assert.ok(Number.isNaN(G.median([])));
});

test('parsePanelResponse extracts per-option scores and pick', () => {
  const txt = panelText([{ score: 90, minGoal: 8 }, { score: 70, minGoal: 6 }], 1);
  const p = G.parsePanelResponse(txt, 2);
  assert.equal(p.scores[0].score, 90);
  assert.equal(p.scores[1].minGoal, 6);
  assert.equal(p.pick, 1);
});

test('aggregate picks highest median honoring min-goal floor', () => {
  const panel = [
    { scores: [{ score: 90, minGoal: 8 }, { score: 95, minGoal: 5 }] },
    { scores: [{ score: 88, minGoal: 8 }, { score: 96, minGoal: 5 }] },
    { scores: [{ score: 92, minGoal: 8 }, { score: 97, minGoal: 5 }] },
  ];
  const agg = G.aggregate(panel, 2);
  // Option 2 has higher score but violates min(G)>=7 → option 1 chosen.
  assert.equal(agg.chosen.option, 1);
  assert.equal(agg.goalLensRespected, true);
});

test('aggregate returns chosen=null on an empty pool (no undefined leak — cross-family review fix)', () => {
  assert.equal(G.aggregate([], 0).chosen, null);
  assert.equal(G.aggregate([{ scores: [] }], 1).chosen.option, 1); // present but unscored option still returned
});

test('adjudicate runs a ≥3-family panel and returns the highest-rated option', async () => {
  const fleet = async () => ({ ok: true, text: panelText([{ score: 80, minGoal: 8 }, { score: 90, minGoal: 8 }], 2) });
  const byProvider = {
    groq: panelText([{ score: 82, minGoal: 8 }, { score: 91, minGoal: 8 }], 2),
    mistral: panelText([{ score: 79, minGoal: 8 }, { score: 93, minGoal: 8 }], 2),
  };
  const dispatchProvider = async (name) => ({ ok: !!byProvider[name], text: byProvider[name] || '' });
  const out = await G.adjudicate('Which option?', ['A', 'B'], {
    dispatchFleet: fleet, dispatchProvider, providers: ['groq', 'cerebras', 'mistral'], diversityFloor: 3,
  });
  assert.equal(out.degraded, false);
  assert.equal(out.diversity, 3);
  assert.equal(out.chosen, 2);
  assert.equal(out.goalLensRespected, true);
});

test('adjudicate enforces DISTINCT families (groq+cerebras are both llama → one slot)', async () => {
  const fleet = async () => ({ ok: true, text: panelText([{ score: 80, minGoal: 8 }], 1) });
  const dispatchProvider = async () => ({ ok: true, text: panelText([{ score: 80, minGoal: 8 }], 1) });
  // Only qwen + llama families available → 2 < floor 3 → degraded self-resolution.
  const out = await G.adjudicate('Q?', ['A'], {
    dispatchFleet: fleet, dispatchProvider, providers: ['groq', 'cerebras'], diversityFloor: 3,
  });
  assert.equal(out.degraded, true);
  assert.equal(out.route, 'self-resolve');
  assert.equal(out.diversity, 2);
});

test('adjudicate degrades to self-resolution below the diversity floor (never prompts client)', async () => {
  const fleet = async () => ({ ok: false, text: '' });
  const dispatchProvider = async () => ({ ok: false, text: '' });
  const out = await G.adjudicate('Q?', ['A', 'B'], { dispatchFleet: fleet, dispatchProvider, providers: ['groq'] });
  assert.equal(out.degraded, true);
  assert.equal(out.route, 'self-resolve');
  assert.notEqual(out.route, 'human-carveout');
});

test('websearch grounding is injected ONLY for high-stakes/novel (G3 cost)', () => {
  const routine = G.buildPanelPrompt('Q', ['A', 'B'], null);
  assert.ok(!routine.includes('CURRENT BEST-PRACTICE'));
  const grounded = G.buildPanelPrompt('Q', ['A', 'B'], 'web fact 1');
  assert.ok(grounded.includes('CURRENT BEST-PRACTICE'));
});

test('decide() logs every decision via the injected logger (G8)', async () => {
  const records = [];
  const out = await G.decide({ question: 'Fix a typo' }, { logger: (r) => records.push(r) });
  assert.equal(out.route, 'self-resolve');
  assert.equal(records.length, 1);
  assert.equal(records[0].question, 'Fix a typo');
});

test('decide() never throws and never returns a bare client prompt for adjudicable input', async () => {
  const out = await G.decide(
    { question: 'Which lock strategy?', options: ['flock', 'lease'] },
    { dispatchFleet: async () => ({ ok: false }), dispatchProvider: async () => ({ ok: false }), providers: [] },
  );
  assert.ok(['adjudicate', 'self-resolve'].includes(out.route));
});

test('anti-goal: a security-weakening option is never auto-executed (routed to human)', async () => {
  const out = await G.decide({ question: 'Should we remove the security control guarding secrets?' });
  assert.equal(out.route, 'human-carveout');
});
