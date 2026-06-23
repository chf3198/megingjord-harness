'use strict';
// Stress test for the baton-progression guardrail (#2957).
// Required because this surface (a) parses untrusted input (baton comments from PRs /
// issue threads) and (b) mutates shared state (appends to incidents.jsonl) — both are
// stress-applicability triggers per instructions/test-methodology-matrix.instructions.md.
// Asserts: >=1 fault-injection / chaos path (G6) AND >=1 p99 latency budget (G7).
const { test } = require('node:test');
const assert = require('node:assert/strict');

const {
  checkBatonProgression,
  latestTimestampsByStage,
  emitProgressionIncident,
} = require('../scripts/global/baton-progression-parity.js');

// ---- G6: fault-injection / adversarial input must never throw ----
test('chaos: malformed and adversarial comment shapes never throw', () => {
  const adversarial = [
    null,
    undefined,
    'not-an-array-element',
    42,
    {},
    { body: null, createdAt: null },
    { body: 12345, createdAt: 'not-a-date' },
    { body: 'MANAGER_HANDOFF', createdAt: undefined },
    { body: 'MANAGER_HANDOFF', createdAt: 'garbage' },
    // artifact name embedded in prose must still be detected by substring (worst case)
    { body: 'I will not post a COLLABORATOR_HANDOFF yet', createdAt: new Date(0).toISOString() },
    { body: 'ADMIN_HANDOFF'.repeat(1000), createdAt: new Date(1000).toISOString() },
  ];
  const inputs = [adversarial, null, undefined, 'string', 99, {}, [[]]];
  for (const input of inputs) {
    assert.doesNotThrow(() => checkBatonProgression(input));
    assert.doesNotThrow(() => latestTimestampsByStage(input));
    const result = checkBatonProgression(input);
    assert.ok(result === null || (result && typeof result.rule === 'string'));
  }
});

test('chaos: incident emission to an unwritable path is swallowed', () => {
  const fs = require('node:fs');
  const os = require('node:os');
  const path = require('node:path');
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'bpp-stress-'));
  const blocker = path.join(dir, 'blocker');
  fs.writeFileSync(blocker, 'x'); // a regular file as the parent dir -> mkdir ENOTDIR
  assert.doesNotThrow(() => {
    const ok = emitProgressionIncident(
      { rule: 'baton-progression-gap', detail: 'x' },
      { incidentsPath: path.join(blocker, 'nested', 'incidents.jsonl') },
    );
    assert.equal(ok, false);
  });
});

test('chaos: determinism under repeated evaluation of the same large input', () => {
  const big = [];
  const base = Date.parse('2026-06-22T00:00:00Z');
  for (let i = 0; i < 4000; i++) {
    big.push({ body: `noise comment ${i}`, createdAt: new Date(base + i * 1000).toISOString() });
  }
  big.push({ body: 'MANAGER_HANDOFF', createdAt: new Date(base + 5000 * 1000).toISOString() });
  big.push({ body: 'ADMIN_HANDOFF', createdAt: new Date(base + 6000 * 1000).toISOString() });
  const first = JSON.stringify(checkBatonProgression(big));
  for (let i = 0; i < 50; i++) {
    assert.equal(JSON.stringify(checkBatonProgression(big)), first);
  }
  // skipped COLLABORATOR -> gap
  assert.equal(JSON.parse(first).rule, 'baton-progression-gap');
});

// ---- G7: p99 latency budget ----
test('p99 latency budget on a large comment set', () => {
  const base = Date.parse('2026-06-22T00:00:00Z');
  const comments = [];
  for (let i = 0; i < 5000; i++) {
    comments.push({ body: `comment ${i} with some text`, createdAt: new Date(base + i * 1000).toISOString() });
  }
  comments.push({ body: 'MANAGER_HANDOFF', createdAt: new Date(base + 6000 * 1000).toISOString() });
  comments.push({ body: 'COLLABORATOR_HANDOFF', createdAt: new Date(base + 6100 * 1000).toISOString() });

  const N = 200;
  const samples = [];
  for (let i = 0; i < N; i++) {
    const t0 = process.hrtime.bigint();
    checkBatonProgression(comments);
    const t1 = process.hrtime.bigint();
    samples.push(Number(t1 - t0) / 1e6); // ms
  }
  samples.sort((a, b) => a - b);
  const p99 = samples[Math.min(samples.length - 1, Math.floor(samples.length * 0.99))];
  const BUDGET_MS = 50;
  assert.ok(p99 < BUDGET_MS, `p99 ${p99.toFixed(2)}ms exceeded budget ${BUDGET_MS}ms`);
});
