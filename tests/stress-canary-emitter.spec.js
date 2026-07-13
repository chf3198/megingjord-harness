// stress-canary-emitter.spec.js -- Stress coverage for the canary emitter. Refs #3795, Epic #3789.
// The emitter is a SIDE-EFFECT-bearing surface (appends to dashboard/events.jsonl), so per the
// test-methodology-matrix it MUST assert (G6) a fault-injection/side-effect-integrity path AND
// (G7) a p99 latency budget. test_strategy: stress-test.
'use strict';

const { describe, it, afterEach } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const ce = require('../scripts/global/canary-emitter');
const { isValidV3 } = require('../scripts/global/event-schema-v3');

let file;
afterEach(() => { try { fs.unlinkSync(file); } catch { /* best-effort */ } });

describe('stress: side-effect integrity under concurrent emit (G6)', () => {
  it('500 concurrent emits to one file produce 500 uncorrupted, valid v3 lines', async () => {
    file = path.join(os.tmpdir(), `canary-stress-${process.pid}-${process.hrtime.bigint()}.jsonl`);
    fs.writeFileSync(file, '');
    const N = 500;
    await Promise.all(Array.from({ length: N }, (_v, i) => Promise.resolve().then(() => {
      const metrics = { error_rate: (i % 7) / 100, auth_reject_rate: 0, latency_p99_ms: i % 900 };
      return ce.evaluateAndEmit(`flag-${i}`, metrics, file);
    })));
    const lines = fs.readFileSync(file, 'utf8').trim().split('\n');
    assert.equal(lines.length, N, 'no lost or torn writes');
    for (const line of lines) {
      let parsed;
      assert.doesNotThrow(() => { parsed = JSON.parse(line); }, 'each line is intact JSON');
      assert.equal(isValidV3(parsed).ok, true, 'each line is a valid v3 event');
      assert.match(parsed.event, /^event:canary-(rollback|promote)$/);
    }
  });
});

describe('stress: rollback-predicate p99 budget (G7)', () => {
  it('rollbackPredicate p99 stays under 1ms across 10000 evaluations', () => {
    const samples = [];
    for (let i = 0; i < 10000; i += 1) {
      const metrics = { error_rate: (i % 5) / 100, auth_reject_rate: (i % 3) / 100, latency_p99_ms: i % 1000 };
      const t0 = process.hrtime.bigint();
      ce.rollbackPredicate(metrics);
      samples.push(Number(process.hrtime.bigint() - t0) / 1e6);
    }
    samples.sort((a, b) => a - b);
    const p99 = samples[Math.floor(samples.length * 0.99)];
    assert.ok(p99 < 1, `rollbackPredicate p99 ${p99.toFixed(4)}ms exceeds 1ms budget`);
  });
});
