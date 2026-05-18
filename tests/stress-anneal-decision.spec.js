'use strict';
// Stress tests for Epic #1855 anneal-decision detector — adversarial corpus + perf.
// Goal alignment: G2 quality, G6 resilience, G7 throughput.

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { test } = require('node:test');
const { evaluate, findMarkers, RECOGNITION_MARKERS, DECISION_MARKERS }
  = require('../scripts/global/anneal-decision-detector.js');

const CORPUS_PATH = path.join(__dirname, '..', 'inventory', 'anneal-decision-adversarial-corpus.json');
const SKIP = { skipRecordedScan: true };

test('CORPUS exists and well-formed', () => {
  const corpus = JSON.parse(fs.readFileSync(CORPUS_PATH, 'utf8'));
  assert.ok(Array.isArray(corpus.items));
  assert.ok(corpus.items.length >= 25);
  assert.ok(corpus.thresholds.precision_min >= 0.85);
});

test('AC7: corpus precision >= 0.85 over true_positive items', () => {
  const corpus = JSON.parse(fs.readFileSync(CORPUS_PATH, 'utf8'));
  const trueP = corpus.items.filter(item => item.category === 'true_positive');
  let correct = 0;
  for (const item of trueP) {
    const r = evaluate(item.text, SKIP);
    if (r.ok === item.expected_ok) correct++;
  }
  const precision = correct / trueP.length;
  assert.ok(precision >= 0.85,
    `precision ${precision.toFixed(2)} below 0.85 floor (${correct}/${trueP.length})`);
});

test('AC7: corpus recall >= 0.85 across all categories', () => {
  const corpus = JSON.parse(fs.readFileSync(CORPUS_PATH, 'utf8'));
  let agree = 0;
  for (const item of corpus.items) {
    const r = evaluate(item.text, SKIP);
    if (r.ok === item.expected_ok) agree++;
  }
  const recall = agree / corpus.items.length;
  assert.ok(recall >= 0.85, `recall ${recall.toFixed(2)} below 0.85 floor (${agree}/${corpus.items.length})`);
});

test('AC7: true_negatives never falsely flagged', () => {
  const corpus = JSON.parse(fs.readFileSync(CORPUS_PATH, 'utf8'));
  const trueN = corpus.items.filter(item => item.category === 'true_negative');
  let correct = 0;
  for (const item of trueN) {
    const r = evaluate(item.text, SKIP);
    if (r.ok === true) correct++;
  }
  assert.equal(correct, trueN.length,
    `${trueN.length - correct} true_negative item(s) wrongly flagged as not-ok`);
});

test('PERF: detector latency < 5ms per evaluation on small text (AC7)', () => {
  const text = 'If you want, we should file a ticket. This is a recurrence.';
  const samples = [];
  for (let i = 0; i < 500; i++) {
    const start = process.hrtime.bigint();
    evaluate(text, SKIP);
    samples.push(Number(process.hrtime.bigint() - start) / 1_000_000);
  }
  samples.sort((a, b) => a - b);
  const p99 = samples[Math.floor(samples.length * 0.99)];
  assert.ok(p99 < 5, `detector p99 ${p99.toFixed(2)}ms exceeds 5ms budget`);
});

test('PERF: detector on 10KB text < 50ms', () => {
  const text = ('Long benign content. '.repeat(500)) + 'If you want, file it.';
  const start = process.hrtime.bigint();
  evaluate(text, SKIP);
  const elapsed = Number(process.hrtime.bigint() - start) / 1_000_000;
  assert.ok(elapsed < 50, `detector on 10KB ${elapsed.toFixed(2)}ms exceeds 50ms budget`);
});

test('RESILIENCE: empty input returns ok', () => {
  const r = evaluate('', SKIP);
  assert.equal(r.ok, true);
});

test('RESILIENCE: null input handled gracefully', () => {
  const r = evaluate(null, SKIP);
  assert.equal(r.ok, true);
});

test('RESILIENCE: undefined input handled gracefully', () => {
  const r = evaluate(undefined, SKIP);
  assert.equal(r.ok, true);
});

test('FUZZ: 100 random text snippets — never throws', () => {
  const words = ['flaw', 'drift', 'violation', 'recurrence', 'gap', 'trap', 'class',
    'file-ticket', 'log-incident-only', 'memory-note-only', 'no-action-justified',
    'we', 'should', 'if', 'you', 'want', 'this', 'is', 'a', 'pattern_id'];
  for (let i = 0; i < 100; i++) {
    const len = 5 + Math.floor(Math.random() * 50);
    const text = Array.from({ length: len }, () => words[Math.floor(Math.random() * words.length)]).join(' ');
    assert.doesNotThrow(() => evaluate(text, SKIP), `iteration ${i} threw on input: ${text}`);
  }
});

test('ADVERSARIAL (known v1 limit): zero-width-space bypass succeeds — recorded as future hardening', () => {
  const text = 'if you​ want we should file';
  const r = evaluate(text, SKIP);
  // v1 detector does NOT NFKC-normalize before regex; documented limit. Tightening tracked
  // via red-team follow-on #1860 (lock-tampering + Unicode-confusable mitigations).
  assert.equal(r.ok, true, 'v1 detector misses ZWSP-stuffed phrases (documented limit)');
});
