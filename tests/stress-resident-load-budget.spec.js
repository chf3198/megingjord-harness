'use strict';
// Stress test for the C4 fail-closed on-demand loader (Epic #3807 / #3812). Asserts BOTH facets the
// test-methodology matrix requires of a stress strategy:
//   (G6) a fault-injection path — the loader fails closed under injected absent/empty rules; and
//   (G7) a p99 latency budget — on-demand load stays fast under contention (the round-2 panel note).
const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const budget = require('../scripts/global/resident-load-budget.js');

const P99_BUDGET_MS = 25; // per-load p99 ceiling under repeated contention
const ITERATIONS = 2000;

function percentile(samples, pct) {
  const sorted = [...samples].sort((a, b) => a - b);
  return sorted[Math.min(sorted.length - 1, Math.floor((pct / 100) * sorted.length))];
}

test('G7 — on-demand load p99 stays within budget under repeated contention', () => {
  const durations = [];
  for (let i = 0; i < ITERATIONS; i += 1) {
    const start = process.hrtime.bigint();
    const rules = budget.requireForOperation('resource-tier-selection');
    const elapsedMs = Number(process.hrtime.bigint() - start) / 1e6;
    assert.strictEqual(rules[0].loaded, true, 'rule loads on every iteration');
    durations.push(elapsedMs);
  }
  const p99 = percentile(durations, 99);
  assert.ok(p99 < P99_BUDGET_MS, `on-demand load p99 ${p99.toFixed(3)}ms must be < ${P99_BUDGET_MS}ms`);
});

test('G6 — fault injection: every absent/empty migrated rule fails closed (never silent success)', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'rlb-stress-'));
  const faults = ['missing-a.md', 'missing-b.md', 'empty-a.instructions.md'];
  fs.writeFileSync(path.join(dir, 'empty-a.instructions.md'), '\n\n   \n');
  let blocked = 0;
  for (const name of faults) {
    try {
      budget.loadOnDemand(name, dir);
    } catch (err) {
      if (err instanceof budget.OnDemandLoadError) blocked += 1;
    }
  }
  assert.strictEqual(blocked, faults.length, 'all injected faults must block (fail-closed), none silently pass');
  fs.rmSync(dir, { recursive: true, force: true });
});
