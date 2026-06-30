// stress-test spec for the client-prompt-rate observability module (#3405, Epic #3392 AC4).
// The module mutates shared state (JSONL append), so per the matrix it needs a stress spec asserting
// ≥1 chaos / fault-injection path (G6) AND ≥1 p99 latency budget (G7).
const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const M = require('../scripts/global/client-prompt-rate');

const TS = '2026-06-30T00:00:00.000Z';

test('G6: malformed / adversarial events never crash computeClientPromptRate', () => {
  const garbage = [
    null, undefined, 42, 'string', {}, { event: 'other' },
    { event: 'governance.client-prompt-decision' }, // missing fields
    { event: 'governance.client-prompt-decision', non_carve_out_prompt: 'yes' }, // wrong type
    { event: 'governance.client-prompt-decision', non_carve_out_prompt: true, reached_human: true },
  ];
  let r;
  assert.doesNotThrow(() => { r = M.computeClientPromptRate(garbage); });
  assert.ok(r.rate >= 0 && r.rate <= 1);
  assert.equal(r.nonCarveOutPrompts, 1); // only the one well-formed non-carve-out prompt counts
});

test('G6: many concurrent-ish appends to one surface stay parseable (no torn lines)', () => {
  const file = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'cpr-stress-')), 'events.jsonl');
  for (let i = 0; i < 500; i++) {
    M.recordDecision({ route: i % 3 === 0 ? 'human-carveout' : (i % 3 === 1 ? 'adjudicate' : 'self-resolve'), tier: 't' }, { file, ts: TS });
  }
  const lines = fs.readFileSync(file, 'utf8').split('\n').filter(Boolean);
  assert.equal(lines.length, 500);
  assert.doesNotThrow(() => lines.forEach((l) => JSON.parse(l))); // every line is valid JSON
});

test('G6: a fail-open write to an unwritable surface is bounded and silent', () => {
  // recordDecision returns false rather than throwing — the decision it observes is never blocked.
  // ENOTDIR (a file used as a parent dir) fails fast; avoid /proc which can hang the runner.
  const blocker = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'cpr-bad-')), 'blocker');
  fs.writeFileSync(blocker, 'x');
  const bad = path.join(blocker, 'z.jsonl');
  for (let i = 0; i < 100; i++) {
    assert.equal(M.recordDecision({ route: 'self-resolve' }, { file: bad }), false);
  }
});

test('G7: computeClientPromptRate p99 < 20ms over a 5000-event set', () => {
  const events = Array.from({ length: 5000 }, (_, i) => ({
    event: 'governance.client-prompt-decision',
    reached_human: i % 4 === 0, non_carve_out_prompt: i % 8 === 0, carve_out: i % 4 === 0 ? 'human-carveout' : null,
  }));
  const samples = [];
  for (let i = 0; i < 200; i++) {
    const t = process.hrtime.bigint();
    M.computeClientPromptRate(events);
    samples.push(Number(process.hrtime.bigint() - t) / 1e6);
  }
  samples.sort((a, b) => a - b);
  const p99 = samples[Math.floor(samples.length * 0.99)];
  assert.ok(p99 < 20, `computeClientPromptRate p99=${p99.toFixed(3)}ms exceeds 20ms budget`);
});
