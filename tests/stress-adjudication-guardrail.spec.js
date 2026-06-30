// stress-test suite for the adjudication guardrail (#3401, Epic #3392).
// Per the test matrix a stress spec MUST assert: ≥1 chaos / fault-injection path (G6)
// AND ≥1 p99 latency budget (G7). The guardrail is a side-effect-bearing decision gate
// that parses untrusted model output, so both apply.
const test = require('node:test');
const assert = require('node:assert');
const G = require('../scripts/global/adjudication-guardrail');

function panelText(scores, pick) {
  return scores.map((s, i) => `SCORE ${i + 1}: ${s.score} MINGOAL ${s.minGoal} :: r`).concat(`PICK ${pick}`).join('\n');
}

// ---- G6 chaos / fault-injection: panelists fail, time out, or return garbage ----

test('G6: every panelist throws → degrades to self-resolution, never throws, never prompts client', async () => {
  const boom = async () => { throw new Error('provider exploded'); };
  const out = await G.adjudicate('Q?', ['A', 'B'], {
    dispatchFleet: boom, dispatchProvider: boom, providers: ['groq', 'mistral', 'gemini'], timeoutMs: 50,
  });
  assert.equal(out.degraded, true);
  assert.equal(out.route, 'self-resolve');
  assert.notEqual(out.route, 'human-carveout');
});

test('G6: adversarial / malformed panel output is parsed safely (no crash, no NaN pick leak)', async () => {
  const garbage = [
    'SCORE 1: not-a-number MINGOAL ?? :: x',          // unparseable numbers
    'SCORE 99: 9999 MINGOAL 50 :: out-of-range index', // option index out of range
    '‮RTL-override‬ PICK 7',                  // trojan-source / bidi override
    'SCORE 1: 80 MINGOAL 8 :: ok\nPICK 1',             // one valid line
  ].join('\n');
  const dispatch = async () => ({ ok: true, text: garbage });
  const out = await G.adjudicate('Q?', ['A', 'B'], {
    dispatchFleet: dispatch, dispatchProvider: dispatch,
    providers: ['groq', 'mistral', 'gemini'], diversityFloor: 3,
  });
  // Must not crash; chosen is either a valid in-range option or null, never an out-of-range index.
  assert.ok(out.chosen === null || (out.chosen >= 1 && out.chosen <= 2));
});

test('G6: a hung panelist (never resolves) is bounded by the timeout, not the whole call', async () => {
  const hang = () => new Promise(() => {}); // never resolves
  const ok = async () => ({ ok: true, text: panelText([{ score: 80, minGoal: 8 }], 1) });
  const out = await G.adjudicate('Q?', ['A'], {
    dispatchFleet: hang, dispatchProvider: ok, providers: ['groq', 'mistral'], diversityFloor: 1, timeoutMs: 100,
  });
  // Fleet hangs but providers satisfy floor=1 → resolves without waiting forever.
  assert.ok(out.route === 'adjudicate' || out.route === 'self-resolve');
});

// ---- G7 p99 latency budget: classification + aggregation are pure/fast ----

test('G7: classifyDecision p99 < 5ms over 1000 calls (pure detector budget)', () => {
  const samples = [];
  for (let i = 0; i < 1000; i++) {
    const t = process.hrtime.bigint();
    G.classifyDecision({ question: `Which option ${i}?`, options: ['x', 'y'] });
    samples.push(Number(process.hrtime.bigint() - t) / 1e6);
  }
  samples.sort((a, b) => a - b);
  const p99 = samples[Math.floor(samples.length * 0.99)];
  assert.ok(p99 < 5, `classifyDecision p99=${p99.toFixed(3)}ms exceeds 5ms budget`);
});

test('G7: aggregate p99 < 10ms for a 3-family / 5-option panel', () => {
  const panel = Array.from({ length: 3 }, () => ({
    scores: Array.from({ length: 5 }, (_, i) => ({ score: 70 + i, minGoal: 8 })),
  }));
  const samples = [];
  for (let i = 0; i < 1000; i++) {
    const t = process.hrtime.bigint();
    G.aggregate(panel, 5);
    samples.push(Number(process.hrtime.bigint() - t) / 1e6);
  }
  samples.sort((a, b) => a - b);
  const p99 = samples[Math.floor(samples.length * 0.99)];
  assert.ok(p99 < 10, `aggregate p99=${p99.toFixed(3)}ms exceeds 10ms budget`);
});
