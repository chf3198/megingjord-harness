'use strict';
// tdd-pyramid unit tests for the Fleet Advisor IT advisory contract (Epic #3414 #3482).

const assert = require('node:assert/strict');
const { test } = require('node:test');
const rep = require('../scripts/global/fleet-advisor-report.js');

test('classifyAction — deterministic IT-actionable high/med → A; ai-only → B; client → C', () => {
  assert.equal(rep.classifyAction({ class: 'IT-actionable', severity: 'high', source: 'lint' }), 'A');
  assert.equal(rep.classifyAction({ class: 'IT-actionable', severity: 'med', source: 'lint' }), 'A');
  assert.equal(rep.classifyAction({ class: 'IT-actionable', severity: 'low', source: 'lint' }), 'B');
  assert.equal(rep.classifyAction({ class: 'IT-actionable', severity: 'high', source: 'ai-research', aiOnly: true }), 'B');
  assert.equal(rep.classifyAction({ class: 'client', severity: 'high' }), 'C');
  assert.equal(rep.classifyAction(null), 'B');
});

test('buildAdvisoryReport partitions findings into A/B/C', () => {
  const report = rep.buildAdvisoryReport({ tier: 'F2', findings: [
    { id: 'a', class: 'IT-actionable', severity: 'high', source: 'lint' },
    { id: 'b', class: 'IT-actionable', severity: 'low', source: 'lint' },
    { id: 'c', class: 'client', severity: 'high' },
  ] });
  assert.equal(report.classA.length, 1);
  assert.equal(report.classB.length, 1);
  assert.equal(report.classC.length, 1);
  assert.equal(report.tier, 'F2');
});

test('AC1 — executeClassA REFUSES without a recorded rollback (advisory-only)', () => {
  const out = rep.executeClassA({ id: 'x', class: 'IT-actionable', severity: 'high' }, { writeAudit: () => true, apply: () => {} });
  assert.equal(out.ok, false);
  assert.equal(out.reason, 'no-rollback-refuse');
});

test('AC1 — atomic-or-abort: audit write failure ABORTS (no audit ⇒ no action)', () => {
  let applied = false;
  const out = rep.executeClassA(
    { id: 'x', class: 'IT-actionable', severity: 'high', rollback: 'undo' },
    { writeAudit: () => false, apply: () => { applied = true; } });
  assert.equal(out.ok, false);
  assert.equal(out.reason, 'audit-write-failed-abort');
  assert.equal(applied, false); // the action NEVER ran
});

test('AC1 — Class A runs only after the paired rollback is durably audited; never a ticket/commit', () => {
  const audits = [];
  let applied = false;
  const out = rep.executeClassA(
    { id: 'L-WARM-01', class: 'IT-actionable', severity: 'high', rollback: 'unset keep_alive' },
    { writeAudit: (e) => { audits.push(e); return true; }, apply: () => { applied = true; }, now: 42 });
  assert.equal(out.ok, true);
  assert.equal(out.executed, true);
  assert.equal(applied, true);
  assert.equal(audits.length, 1);
  assert.equal(audits[0].rollback, 'unset keep_alive');
  assert.equal(audits[0].marker, 'it-ops'); // it-ops bypass, not a baton ticket
});

test('AC1 — a non-Class-A action is refused by the executor', () => {
  assert.equal(rep.executeClassA({ id: 'c', class: 'client', severity: 'high', rollback: 'x' }, { writeAudit: () => true }).reason, 'not-class-a');
});

test('AC3 — hardwareOnlyView strips host id/url/IP, keeps engine + VRAM bucket', () => {
  const view = rep.hardwareOnlyView({ hosts: [{ id: 'host-a', url: 'http://100.91.113.16:11434', engine: 'ollama@0.30', vramBucket: 'discrete' }] }, 'F2');
  const json = JSON.stringify(view);
  assert.doesNotMatch(json, /100\.91\.113\.16/);
  assert.doesNotMatch(json, /host-a/);
  assert.match(json, /ollama/);
  assert.match(json, /discrete/);
});

test('renderReportMarkdown produces the three class sections', () => {
  const md = rep.renderReportMarkdown(rep.buildAdvisoryReport({ tier: 'F2', findings: [{ id: 'a', class: 'IT-actionable', severity: 'high', source: 'lint', title: 't', recommendation: 'r' }] }));
  assert.match(md, /Class A/);
  assert.match(md, /Class B/);
  assert.match(md, /Class C/);
});
