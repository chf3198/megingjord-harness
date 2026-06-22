'use strict';
// Stress coverage for open-pr-closeout-check (#3028) — side-effect-bearing pre-push gate.
// Asserts a chaos/fault-injection path (G6) AND a p99 decision-latency budget (G7).

const { test, expect } = require('@playwright/test');
const { decide, run } = require('../scripts/global/open-pr-closeout-check.js');

test('chaos: a flaky fetcher (rejects mid-scan) degrades, never hangs (G6)', async () => {
  const fetchers = {
    listOpenPRs: async () => [{ number: 1, body: 'Refs #10' }],
    getIssue: async () => { throw new Error('simulated gh outage'); },
  };
  // run() catches inside scanOpenPRs? scanOpenPRs awaits getIssue, which throws -> run rejects.
  // The gate's CLI wrapper swallows it; here we assert run() rejects rather than hangs.
  await expect(run({ blockMode: true, commitSubject: 'x', fetchers })).rejects.toThrow(/gh outage/);
});

test('chaos: hundreds of PRs all missing closeout are all reported in block mode (G6)', async () => {
  const prs = Array.from({ length: 400 }, (_, index) => ({ number: index, body: `Refs #${1000 + index}` }));
  const fetchers = { listOpenPRs: async () => prs, getIssue: async () => ({ comments: [] }) };
  const result = await run({ blockMode: true, commitSubject: 'x', fetchers });
  expect(result.exitCode).toBe(1);
  expect(result.message.split('\n').length).toBeGreaterThan(400);
});

test('p99 decide() latency stays within budget under load (G7)', () => {
  const findings = Array.from({ length: 200 }, (_, index) => ({ pr: index, issue: 1000 + index }));
  const samples = [];
  for (let iteration = 0; iteration < 1000; iteration += 1) {
    const start = process.hrtime.bigint();
    decide(findings, { blockMode: true, overridden: false });
    samples.push(Number(process.hrtime.bigint() - start) / 1e6);
  }
  samples.sort((a, b) => a - b);
  expect(samples[Math.floor(samples.length * 0.99)]).toBeLessThan(5);
});
