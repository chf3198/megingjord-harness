// Stress / fault-injection for the Phase-0->Phase-1 promotion gate
// (Epic #2678; test_strategy tdd-pyramid+stress-test). Asserts >=1 chaos path
// (G6 resilience) and >=1 p99 latency budget (G7 throughput).
const { test, expect } = require('@playwright/test');
const os = require('os');
const fs = require('fs');
const path = require('path');

const TMP_HOME = fs.mkdtempSync(path.join(os.tmpdir(), 'phase0-stress-'));
process.env.HOME = TMP_HOME;
const gate = require('../scripts/global/megalint/phase0-promotion-gate');
const resolver = require('../scripts/global/phase0-promotion-resolver');
const guard = require('../scripts/global/phase0-closure-guard');
const { makeGithub, makeCore } = require('./phase0-github-mock');

test('G6 chaos: resolve survives a faulting child issues.get (skips it, no throw)', async () => {
  const { github } = makeGithub({
    issues: {
      500: { state: 'open', labels: ['type:epic', 'phase-gate:research-first'], body: 'kids #501 #502' },
      501: { state: 'closed', labels: ['phase-gate:research-first'], body: 'Parent: #500' },
    },
    commentsByIssue: { 500: [{ body: 'EPIC_RESCOPE' }], 501: [{ body: 'CONSULTANT_CLOSEOUT' }] },
    failGetFor: new Set([502]), // #502 fetch faults — must be skipped, not fatal
  });
  const r = await resolver.resolve({ github, owner: 'o', repo: 'r', epicNumber: 500 });
  expect(r.phase0Count).toBe(1);
  expect(r.missingPhase1Children).toBe(true);
});

test('G6 chaos: guard still fails the run when the BLOCKER_NOTE comment post throws', async () => {
  const { github } = makeGithub({
    issues: {
      500: { state: 'closed', labels: ['type:epic', 'phase-gate:research-first'], body: 'child #501' },
      501: { state: 'closed', labels: ['phase-gate:research-first'], body: 'Parent: #500' },
    },
    commentsByIssue: { 500: [{ body: 'EPIC_RESCOPE' }], 501: [{ body: 'CONSULTANT_CLOSEOUT' }] },
  });
  github.rest.issues.createComment = async () => { throw new Error('comment API down'); };
  const { core, calls } = makeCore();
  delete process.env.PHASE0_GATE_BYPASS;
  const r = await guard.run({ github, context: { repo: { owner: 'o', repo: 'r' }, payload: { issue: { number: 500 } } }, core });
  expect(r.blocked).toBe(true);
  expect(calls.setFailed.length).toBe(1); // comment failure does not suppress the block
});

test('G7 p99: phase0GreenComplete stays well under budget over 5000 runs', () => {
  const input = {
    labels: ['type:epic', 'phase-gate:research-first'], comments: [{ body: 'EPIC_RESCOPE' }],
    children: Array.from({ length: 20 }, (_, i) => ({
      number: i, state: 'closed', labels: ['phase-gate:research-first'], comments: [{ body: 'CONSULTANT_CLOSEOUT' }],
    })),
  };
  const samples = [];
  for (let i = 0; i < 5000; i++) {
    const t0 = process.hrtime.bigint();
    gate.phase0GreenComplete(input);
    samples.push(Number(process.hrtime.bigint() - t0) / 1e6);
  }
  samples.sort((a, b) => a - b);
  const p99 = samples[Math.floor(samples.length * 0.99)];
  expect(p99).toBeLessThan(2); // p99 < 2ms — a deterministic governance predicate
});
