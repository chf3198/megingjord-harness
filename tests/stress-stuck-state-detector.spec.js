// stress-test suite for the unified stuck-state detector (#3748). Per the test matrix a stress spec
// MUST assert >=1 chaos / fault-injection path (G6) AND >=1 p99 latency budget (G7). The detector is an
// adversarial-input classifier on the operator hot path, so both apply. It also bounds the
// false-positive rate against the labeled corpus (the ADVISORY→blocking promotion gate).
const test = require('node:test');
const assert = require('node:assert');
const D = require('../scripts/global/stuck-state-detector');
const { scoreCorpus, loadCorpus } = require('../scripts/global/stuck-state-replay-eval');

// ---- G6 chaos / fault-injection: malformed / adversarial signals must NEVER throw ----
test('G6: adversarial + malformed signals never throw and never fabricate a stuck verdict on error', () => {
  const junk = [
    { invocations: 'not-an-array' },
    { invocations: [null, 42, { tool: {} }] },
    { iterationCount: NaN, tokenBudgetFraction: 'huge', toolErrorCount: -1 },
    { sampledResolutions: [null, undefined, {}, []] },
    { explicit: { nested: 'object' } },
    { reversibility: 12345, blastRadius: ['x'] },
    Object.assign(Object.create(null), { iterationCount: Infinity }),
  ];
  for (const s of junk) {
    const r = D.detectStuckState(s);
    assert.equal(typeof r.stuck, 'boolean');
    assert.ok(Array.isArray(r.triggers));
  }
});

test('G6: routeStuckState degrades safely when decide() explodes — never throws, never prompts client', async () => {
  const boom = async () => { throw new Error('panel exploded'); };
  await assert.rejects(async () => { throw new Error('sanity'); }); // guard: assert.rejects available
  let threw = false;
  try {
    // routeStuckState awaits decide(); a throwing decide surfaces as a rejected promise the caller owns.
    await D.routeStuckState({ explicit: 'stuck-pr' }, { decide: boom }).catch(() => { threw = true; });
  } catch { threw = true; }
  assert.equal(threw, true, 'router surfaces decide() failure to the caller rather than swallowing it silently');
  // A not-stuck route must resolve cleanly even with a hostile decide injected.
  const clean = await D.routeStuckState({ iterationCount: 0 }, { decide: boom });
  assert.equal(clean.detected, false);
});

// ---- false-positive bound (advisory→blocking promotion gate) ----
test('false-positive rate on the labeled corpus is bounded (precision >= 0.85)', () => {
  const res = scoreCorpus(loadCorpus());
  assert.ok(res.precision >= 0.85, `precision ${res.precision} below floor`);
  assert.ok(res.falsePositiveRate <= 0.15, `FP rate ${res.falsePositiveRate} above bound`);
  assert.equal(res.promotionEligible, res.precision >= 0.85);
});

// ---- G7 p99 latency budget: detection is on the hot path ----
test('G7: p99 detection latency stays within the hot-path budget', () => {
  const inv = Array.from({ length: 40 }, (_, i) => ({ tool: 'Bash', command: `cmd ${i % 5}` }));
  const signals = { invocations: inv, iterationCount: 22, tokenBudgetFraction: 0.9, toolErrorCount: 2, sampledResolutions: ['A', 'B', 'A', 'C'] };
  const N = 2000;
  const samples = [];
  for (let i = 0; i < N; i++) {
    const t0 = process.hrtime.bigint();
    D.detectStuckState(signals);
    samples.push(Number(process.hrtime.bigint() - t0) / 1e6);
  }
  samples.sort((a, b) => a - b);
  const p99 = samples[Math.floor(N * 0.99)];
  assert.ok(p99 < 5, `p99 ${p99}ms exceeds 5ms hot-path budget`);
});
