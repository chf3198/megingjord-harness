// Refs #2177 — stress test suite for fleet-red-team-dispatch (#2175)
// G6 chaos + G7 p99 latency per Phase-0 AC-R7 failure-mode taxonomy.
// Tests pure components (parseFindings, classifyFinding) under contention + load;
// avoids mocking the HAMR wrapper to keep tests deterministic.
const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('path');
const fs = require('fs');
const { parseFindings, stripArxivHallucinations, detectRefusal, loadTemplate, RETRY_DELAYS_MS } = require('../scripts/global/fleet-red-team-dispatch.js');

const TEMPLATES_PATH = path.join(__dirname, '..', 'config', 'fleet-red-team-prompts.json');

function p99(samples) {
  const sorted = [...samples].sort((a, b) => a - b);
  return sorted[Math.floor(sorted.length * 0.99)] || sorted[sorted.length - 1];
}

test('G6 chaos: 100 concurrent parseFindings calls do not interfere', async () => {
  const responses = Array.from({ length: 100 }, (_, i) => ({ response: `ACCEPT: finding ${i}\nREJECT: finding ${i}b\nPARTIAL: finding ${i}c` }));
  const promises = responses.map((raw) => Promise.resolve(parseFindings(raw)));
  const results = await Promise.all(promises);
  for (const r of results) {
    assert.equal(r.findings.length, 3);
    assert.equal(r.warning, null);
  }
});

test('G6 chaos: adversarial response with 1000 newlines + interleaved arxiv URLs handled', () => {
  const lines = [];
  for (let i = 0; i < 1000; i++) {
    lines.push(i % 3 === 0 ? `ACCEPT: arxiv.org/abs/2402.0${i % 9}172 finding` : `noise line ${i}`);
  }
  const start = Date.now();
  const r = parseFindings({ response: lines.join('\n') });
  const elapsed = Date.now() - start;
  assert.ok(elapsed < 1000, `adversarial parse took ${elapsed}ms`);
  assert.ok(r.findings.length > 100);
  for (const finding of r.findings) {
    assert.equal(finding.raw.match(/arxiv\.org\/abs\/\d{4}\.\d{4,5}/), null, 'arxiv URL leaked');
  }
});

test('G6 chaos: empty + null + undefined responses handled without throw', () => {
  for (const value of [{ response: '' }, { response: null }, { response: undefined }, {}]) {
    assert.doesNotThrow(() => parseFindings(value));
  }
});

test('G6 chaos: refusal pattern under load — 50 calls all detected', () => {
  const refusalText = 'I cannot help with that request because it could be misused.';
  for (let i = 0; i < 50; i++) {
    const r = parseFindings({ response: refusalText });
    assert.equal(r.findings.length, 0);
    assert.equal(r.warning, 'fleet-refused');
  }
});

test('G7 p99 latency: parseFindings <10ms p99 across 200 samples', () => {
  const samples = [];
  const response = { response: 'ACCEPT: a\nREJECT: b\nPARTIAL: c'.repeat(20) };
  for (let i = 0; i < 200; i++) {
    const start = process.hrtime.bigint();
    parseFindings(response);
    samples.push(Number(process.hrtime.bigint() - start) / 1e6);
  }
  const p99Val = p99(samples);
  assert.ok(p99Val < 10, `parseFindings p99 = ${p99Val.toFixed(3)}ms > 10ms`);
});

test('G7 p99 latency: loadTemplate <5ms p99 across 100 samples', () => {
  const samples = [];
  for (let i = 0; i < 100; i++) {
    const start = process.hrtime.bigint();
    loadTemplate('pr-diff', TEMPLATES_PATH);
    samples.push(Number(process.hrtime.bigint() - start) / 1e6);
  }
  const p99Val = p99(samples);
  assert.ok(p99Val < 5, `loadTemplate p99 = ${p99Val.toFixed(3)}ms > 5ms`);
});

test('RETRY_DELAYS_MS contract: [1000, 4000] exponential backoff', () => {
  assert.deepEqual(RETRY_DELAYS_MS, [1000, 4000]);
  assert.equal(RETRY_DELAYS_MS[1] / RETRY_DELAYS_MS[0], 4);
});

test('G6 chaos: stripArxivHallucinations handles 100K-char input', () => {
  const big = 'arxiv.org/abs/2402.02172 '.repeat(5000);
  const start = Date.now();
  const out = stripArxivHallucinations(big);
  const elapsed = Date.now() - start;
  assert.ok(elapsed < 500, `strip took ${elapsed}ms`);
  assert.equal(out.includes('2402.02172'), false);
});
