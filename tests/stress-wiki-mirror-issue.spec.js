// tests/stress-wiki-mirror-issue.spec.js — stress + resilience for the live Wiki B
// single-issue mirror (#3066, Epic #3063). Run via `npm run stress:wiki-mirror`.
// Asserts a G6 chaos/fault-injection path AND a G7 p99 latency budget per the
// test-methodology matrix (stress-test composed with golden-file).
// @megalint:test-discoverability:opt-out  (node:test CLI spec, run via npm run stress:*)
'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { test } = require('node:test');

const { mirrorIssue } = require('../scripts/wiki/mirror-issue');

function tmpDir() { return fs.mkdtempSync(path.join(os.tmpdir(), 'mirror-stress-')); }
const baseItem = (over = {}) => ({
  number: 4242, title: 'Stress issue', state: 'OPEN', body: 'stress body',
  labels: [{ name: 'area:knowledge' }], ...over,
});

test('RESILIENCE (G6): malformed/missing-field payloads degrade gracefully, never corrupt', () => {
  const dir = tmpDir();
  // Fault injection: missing body, missing labels, empty body, weird state.
  const faults = [
    baseItem({ body: undefined }),
    baseItem({ labels: undefined }),
    baseItem({ body: '' }),
    baseItem({ state: undefined, title: 'No state' }),
  ];
  for (const item of faults) {
    const res = mirrorIssue(4242, { item, ticketsDir: dir, runId: 'fault', today: '2026-01-01' });
    assert.ok(res.outPath.endsWith('4242.md'), 'must still target the right path');
  }
  // The final written page must be parseable and carry provenance (no corruption).
  const page = fs.readFileSync(path.join(dir, '4242.md'), 'utf8');
  assert.match(page, /source_sha256: [0-9a-f]{64}/, 'provenance survived fault injection');
});

test('RESILIENCE (G6): burst of identical events collapses to a single write (idempotent storm)', () => {
  const dir = tmpDir();
  const item = baseItem();
  let changes = 0;
  // Simulate a label burst: 50 rapid mirror calls on the same source.
  for (let i = 0; i < 50; i += 1) {
    if (mirrorIssue(4242, { item, ticketsDir: dir, runId: `burst-${i}`, today: '2026-01-01' }).changed) changes += 1;
  }
  assert.equal(changes, 1, `idempotent storm must write once, wrote ${changes} times`);
});

test('RESILIENCE (G6): a non-positive-integer number is rejected, never written', () => {
  const dir = tmpDir();
  assert.throws(() => mirrorIssue('../../etc/passwd', { item: baseItem(), ticketsDir: dir }),
    /invalid issue number/);
  assert.equal(fs.existsSync(dir) && fs.readdirSync(dir).length, 0, 'no file written on bad input');
});

test('PERF (G7): mirror p99 latency under 60ms per issue (in-memory item, real file write)', () => {
  const dir = tmpDir();
  const samples = [];
  for (let i = 0; i < 200; i += 1) {
    // Vary the body each iteration so every call performs a real write (worst case).
    const item = baseItem({ number: 4242, body: `body revision ${i}` });
    const start = process.hrtime.bigint();
    mirrorIssue(4242, { item, ticketsDir: dir, runId: `perf-${i}`, today: '2026-01-01' });
    samples.push(Number(process.hrtime.bigint() - start) / 1e6);
  }
  samples.sort((a, b) => a - b);
  const p99 = samples[Math.floor(samples.length * 0.99)];
  assert.ok(p99 < 60, `mirror p99 ${p99.toFixed(2)}ms exceeds 60ms budget`);
});
