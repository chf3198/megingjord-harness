'use strict';
// Stress/adversarial coverage for #2266 issue-only closeout evidence schema.
// Strategy: stress-test (second strategy alongside tdd-pyramid) per test-methodology-matrix —
// consultant-closeout parses untrusted issue-comment text (adversarial-input parser).
// Asserts (1) a fault-injection / adversarial corpus path (G6) and (2) a p99 latency budget (G7).

const test = require('node:test');
const assert = require('node:assert');
const { checkIssueOnlyEvidenceSchema } = require('../scripts/global/megalint/consultant-closeout');

const NO_CODE = ['lane:no-code-remediation'];
const CODE = ['lane:code-change'];

// Non-BMP / control bytes built in-code so no literal control chars live in the source.
const WEIRD = String.fromCharCode(0xFFFF) + String.fromCharCode(0x200B);

// ---------------------------------------------------------------------------
// (1) Adversarial / fault-injection corpus — must never throw, never over-accept.
// ---------------------------------------------------------------------------

const ADVERSARIAL_BODIES = [
  '',                                                  // empty
  WEIRD + 'PR: N/A',                                   // non-BMP / zero-width bytes
  'x_pr: N/A\nx_merge: N/A\nx_ci: N/A\nx_deploy: N/A', // prefix-spoof keys must NOT satisfy
  'PRN/A merge N/A',                                   // missing colons → not declarations
  'pr:N/Aevil'.repeat(5000),                           // pathological repetition (ReDoS probe)
  'PR: NOT-APPLICABLE\nmerge: none\nCI: skip\ndeploy: skip', // near-miss values, not N/A
  '```\nPR: N/A\nmerge: N/A\nCI: N/A\ndeploy: N/A\n```',     // fenced block (still line-matched)
  'a'.repeat(200000),                                  // very long single line
];

test('adversarial corpus: never throws, prefix-spoofed keys never satisfy the schema', () => {
  for (const body of ADVERSARIAL_BODIES) {
    assert.doesNotThrow(() => checkIssueOnlyEvidenceSchema(body, { labels: NO_CODE }), `threw on: ${body.slice(0, 24)}`);
  }
  // Prefix-spoofed keys (x_pr:) must leave all four surfaces unsatisfied.
  const spoof = checkIssueOnlyEvidenceSchema('x_pr: N/A\nx_merge: N/A\nx_ci: N/A\nx_deploy: N/A', { labels: NO_CODE });
  assert.strictEqual(spoof.length, 4, 'prefixed keys must not be accepted as surface declarations');
  // Near-miss non-N/A values must also be rejected.
  const nearMiss = checkIssueOnlyEvidenceSchema('PR: NOT-APPLICABLE\nmerge: none\nCI: skip\ndeploy: skip', { labels: NO_CODE });
  assert.strictEqual(nearMiss.length, 4, 'values other than N/A must not satisfy the schema');
});

test('adversarial: forged code-change closeout claiming issue-only lane in body is rejected', () => {
  // The label is authoritative; a body that fabricates the lane gets no reduced schema.
  const forged = 'CONSULTANT_CLOSEOUT\nlane: lane:no-code-remediation\nPR: N/A (forged)';
  assert.strictEqual(checkIssueOnlyEvidenceSchema(forged, { labels: CODE }).length, 0);
});

// ---------------------------------------------------------------------------
// (2) Perf budget — p99 latency under adversarial load (G7 SLO assertion).
// ---------------------------------------------------------------------------

test('p99 latency budget: <= 5ms per call across 2000 adversarial iterations', () => {
  const body = 'pr:N/Aevil'.repeat(2000) + '\nmerge: N/A\nCI: N/A\ndeploy: N/A';
  const samples = [];
  for (let i = 0; i < 2000; i++) {
    const t0 = process.hrtime.bigint();
    checkIssueOnlyEvidenceSchema(body, { labels: NO_CODE });
    const t1 = process.hrtime.bigint();
    samples.push(Number(t1 - t0) / 1e6); // ms
  }
  samples.sort((a, b) => a - b);
  const p99 = samples[Math.floor(samples.length * 0.99)];
  assert.ok(p99 <= 5, `p99 latency ${p99.toFixed(3)}ms exceeded 5ms budget (ReDoS / pathological-input regression)`);
});
