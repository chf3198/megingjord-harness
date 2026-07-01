'use strict';
// baton-e2e.spec.js — end-to-end fixture for the full Manager→Collaborator→Admin
// →Consultant baton cycle (#2064, origin AC5 of #1944). test_strategy:
// tdd-pyramid+stress-test.
//
// WHAT THIS EXERCISES (AC1-AC5):
//   AC1  simulated in-memory ticket (comments+labels array); no live GitHub issue.
//   AC2  all four baton artifacts are schema-built and pass their megalint validator.
//   AC3  every status+role transition is verified via the canonical baton FSM.
//   AC4  PR-create / CI-green / merge / atomic-close are modelled as FSM evidence
//        bits (PR_MERGED, CI_GREEN, WORKTREE_MERGE_OK) driving triage..done.
//   AC5  a stress surface: fault-injection (chaos) paths + a p99 latency budget.
//
// SIMULATION BOUNDARY (documented, per cross-model panel #2064): a real GitHub
// round-trip (issue create, gh pr merge, issue close) is intentionally NOT made —
// it is non-deterministic, rate-limited, and network-coupled. Those side-effects
// are asserted at the FSM evidence/state layer instead. A live smoke test belongs
// in a separate, network-gated CI job, not this deterministic unit surface.
//
// RETRY POLICY: this fixture is fully deterministic (no network, no clock, no
// randomness beyond the ephemeral Ed25519 evidence key which does not affect
// verdicts). It therefore runs with ZERO retries in CI; a failure is a real
// regression, never flake. The p99 budget is generous (see P99_BUDGET_MS) to
// stay stable on shared CI runners.

const { test } = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const H = require(path.join(__dirname, 'helpers', 'baton-e2e-harness'));
const { createEvidence } = require('../scripts/global/baton-fsm/provenance');

// ---- AC2: all four artifacts build + validate clean -------------------------

test('AC2 — all four baton artifacts pass their megalint validators', () => {
  const artifacts = H.buildAllArtifacts();
  const results = H.runValidators(artifacts);
  for (const [gate, result] of Object.entries(results)) {
    const blocking = (result.violations || []).filter(v => v.severity !== 'advisory');
    assert.equal(result.ok, true,
      `${gate} gate must pass; blocking violations: ${JSON.stringify(blocking)}`);
  }
});

test('AC2 — each artifact carries the canonical signing block for its role', () => {
  const a = H.buildAllArtifacts();
  assert.match(a.manager, /Role: manager/);
  assert.match(a.collaborator, /Role: collaborator/);
  assert.match(a.admin, /Role: admin/);
  assert.match(a.consultant, /Role: consultant/);
  // Signer independence: Admin and Collaborator aliases must differ (Rule).
  const nameOf = body => (body.match(/Signed-by:\s*(.+)/) || [])[1];
  assert.notEqual(nameOf(a.admin), nameOf(a.collaborator));
});

// ---- AC3 + AC4: FSM drives the full happy path to a terminal DONE -----------

test('AC3/AC4 — FSM allows every transition triage..done and terminates at done', async () => {
  const verdicts = await H.driveHappyPath();
  assert.equal(verdicts.length, 7, 'full walk is seven transitions');
  for (const { step, verdict } of verdicts) {
    assert.ok(['allow', 'allow_advisory'].includes(verdict.decision),
      `${step.from} --${step.event}--> ${step.to} must be allowed; got ${verdict.decision} (${verdict.reason})`);
    // Structural: the canonical transition table must actually LAND on step.to, so a
    // silent retargeting of an edge would fail here (not just an allow/deny flip).
    assert.equal(H.canonicalTargetState(step), step.to,
      `${step.from} --${step.event}--> must map to ${step.to} in the transition table`);
  }
  const last = verdicts[verdicts.length - 1];
  assert.equal(last.step.event, 'consultant_closeout');
  assert.equal(last.step.to, 'done', 'cycle ends at terminal status:done');
});

// ---- AC5: fault-injection (chaos) — the gate must DENY bad transitions -------

test('AC5 chaos — missing evidence bit denies the manager_handoff transition', async () => {
  const evidence = await createEvidence({ mask: 0 }); // MANAGER_HANDOFF bit absent
  const verdict = await H.fsm.evaluate('triage', 'manager_handoff', evidence);
  assert.equal(verdict.decision, 'deny', 'insufficient evidence must be denied');
});

test('AC5 chaos — out-of-order transition (ready→admin_handoff) is denied', async () => {
  const evidence = await createEvidence({ mask: H.BITS.ADMIN_HANDOFF });
  const verdict = await H.fsm.evaluate('ready', 'admin_handoff', evidence);
  assert.equal(verdict.decision, 'deny', 'no such edge from ready must be denied');
});

test('AC5 chaos — forged evidence (tampered facts) is rejected by provenance', async () => {
  const evidence = await createEvidence({ mask: H.BITS.MANAGER_HANDOFF });
  evidence.facts.mask = H.BITS.MANAGER_HANDOFF | H.BITS.PR_MERGED; // tamper post-sign
  const verdict = await H.fsm.evaluate('triage', 'manager_handoff', evidence);
  assert.equal(verdict.decision, 'deny', 'hash-mismatch evidence must be denied');
});

test('AC5 chaos — a MANAGER_HANDOFF missing a required field fails its validator', () => {
  const good = H.buildManagerHandoff();
  const broken = good.replace(/gates:.*\n/, ''); // drop the required gates field
  const managerValidator = require('../scripts/global/megalint/manager-handoff');
  const result = managerValidator.validate({ comments: [{ body: broken }], lane: 'lane:code-change' });
  assert.equal(result.ok, false, 'a mid-cycle malformed handoff must be caught');
  assert.ok(result.violations.some(v => v.rule === 'missing-gates'));
});

// ---- AC5: p99 latency budget over repeated full cycles -----------------------

const P99_BUDGET_MS = 150; // generous per-transition ceiling for shared CI runners

test('AC5 perf — p99 per-transition FSM latency stays within budget', async () => {
  const samples = [];
  const ITERATIONS = 30;
  // Warmup: prime the V8 JIT + crypto paths so cold-start spikes don't skew p99 on a
  // shared CI runner (cross-family review #2064, Cerebras finding #1). createEvidence is
  // kept OUTSIDE the timed window below — only fsm.evaluate() is measured.
  for (const step of H.happyPathSteps()) {
    await H.fsm.evaluate(step.from, step.event, await H.evidenceFor(step.mask));
  }
  for (let i = 0; i < ITERATIONS; i++) {
    for (const step of H.happyPathSteps()) {
      const evidence = await H.evidenceFor(step.mask);
      const started = process.hrtime.bigint();
      await H.fsm.evaluate(step.from, step.event, evidence);
      const elapsedMs = Number(process.hrtime.bigint() - started) / 1e6;
      samples.push(elapsedMs);
    }
  }
  samples.sort((a, b) => a - b);
  const p99 = samples[Math.min(samples.length - 1, Math.floor(samples.length * 0.99))];
  const median = samples[Math.floor(samples.length / 2)];
  assert.ok(p99 < P99_BUDGET_MS,
    `p99 transition latency ${p99.toFixed(2)}ms must be < ${P99_BUDGET_MS}ms (n=${samples.length})`);
  assert.ok(median < P99_BUDGET_MS / 3,
    `median steady-state latency ${median.toFixed(2)}ms should be well under budget`);
});
