'use strict';

const assert = require('node:assert/strict');
const { test } = require('node:test');
const {
  evaluate, statusLabels, violationComment, STATUS_PREFIX,
} = require('../scripts/global/label-lint-status-cardinality.js');

test('statusLabels accepts string array', () => {
  const r = statusLabels(['type:task', 'status:backlog', 'priority:P1', 'status:in-progress']);
  assert.deepEqual(r, ['status:backlog', 'status:in-progress']);
});

test('statusLabels accepts GitHub-API label object array', () => {
  const r = statusLabels([
    { name: 'type:task' },
    { name: 'status:in-progress' },
    { name: 'role:collaborator' },
  ]);
  assert.deepEqual(r, ['status:in-progress']);
});

test('evaluate ok when exactly one status label', () => {
  const r = evaluate(['type:task', 'status:in-progress', 'priority:P1']);
  assert.equal(r.ok, true);
  assert.equal(r.status, 'status:in-progress');
});

test('evaluate fails on multi-status (the #1793 case)', () => {
  const r = evaluate(['type:task', 'status:backlog', 'status:in-progress', 'role:collaborator']);
  assert.equal(r.ok, false);
  assert.equal(r.rule, 'multi-status');
  assert.equal(r.found.length, 2);
  assert.ok(r.detail.includes('Epic #1828'));
});

test('evaluate fails on missing-status', () => {
  const r = evaluate(['type:task', 'priority:P1', 'role:manager']);
  assert.equal(r.ok, false);
  assert.equal(r.rule, 'missing-status');
});

test('evaluate handles 3+ statuses with all in detail', () => {
  const r = evaluate(['status:backlog', 'status:queued', 'status:in-progress']);
  assert.equal(r.ok, false);
  assert.equal(r.found.length, 3);
  for (const s of ['status:backlog', 'status:queued', 'status:in-progress']) {
    assert.ok(r.detail.includes(s));
  }
});

test('violationComment returns null on ok', () => {
  const r = evaluate(['status:in-progress']);
  assert.equal(violationComment(r, 1), null);
});

test('violationComment includes ADR-010 marker + Epic #1828 reference', () => {
  const r = evaluate(['status:backlog', 'status:in-progress']);
  const body = violationComment(r, 1793);
  assert.ok(body.includes('<!-- adr-010-status-cardinality -->'));
  assert.ok(body.includes('Epic #1828'));
  assert.ok(body.includes('#1793'));
  assert.ok(body.includes('status:backlog'));
  assert.ok(body.includes('status:in-progress'));
});

test('violationComment for missing-status case', () => {
  const r = evaluate(['type:task']);
  const body = violationComment(r, 999);
  assert.ok(body.includes('no `status:*` label'));
});

test('STATUS_PREFIX exported correctly', () => {
  assert.equal(STATUS_PREFIX, 'status:');
});

test('queued status valid (single)', () => {
  // Validates the new #1828 status:queued doesn't accidentally trip the check.
  const r = evaluate(['type:task', 'status:queued', 'priority:P1']);
  assert.equal(r.ok, true);
  assert.equal(r.status, 'status:queued');
});

test('queued + backlog flagged as multi-status (correctly forbidden)', () => {
  const r = evaluate(['status:queued', 'status:backlog']);
  assert.equal(r.ok, false);
  assert.equal(r.rule, 'multi-status');
});

// #1380: resolveTerminalConflict golden-file tests
const { resolveTerminalConflict, TERMINAL_STATUSES } = require('../scripts/global/label-lint-status-cardinality.js');

test('#1380 TERMINAL_STATUSES exported (done + cancelled)', () => {
  assert.ok(TERMINAL_STATUSES.includes('status:done'));
  assert.ok(TERMINAL_STATUSES.includes('status:cancelled'));
});

test('#1380 status:cancelled + status:backlog → hasConflict, strip backlog', () => {
  const r = resolveTerminalConflict(['type:bug', 'status:backlog', 'status:cancelled', 'priority:P3']);
  assert.equal(r.hasConflict, true);
  assert.equal(r.keepLabel, 'status:cancelled');
  assert.deepEqual(r.removeLabels, ['status:backlog']);
});

test('#1380 status:done + status:backlog → hasConflict, strip backlog', () => {
  const r = resolveTerminalConflict(['status:done', 'status:backlog', 'resolution:completed']);
  assert.equal(r.hasConflict, true);
  assert.equal(r.keepLabel, 'status:done');
  assert.deepEqual(r.removeLabels, ['status:backlog']);
});

test('#1380 status:done + status:backlog + status:in-progress → strip both non-terminal', () => {
  const r = resolveTerminalConflict(['status:done', 'status:backlog', 'status:in-progress']);
  assert.equal(r.hasConflict, true);
  assert.equal(r.keepLabel, 'status:done');
  assert.ok(r.removeLabels.includes('status:backlog'));
  assert.ok(r.removeLabels.includes('status:in-progress'));
  assert.equal(r.removeLabels.length, 2);
});

test('#1380 no terminal in multi-status → hasConflict false (still a violation)', () => {
  const r = resolveTerminalConflict(['status:in-progress', 'status:backlog']);
  assert.equal(r.hasConflict, false);
});

test('#1380 single status → hasConflict false', () => {
  const r = resolveTerminalConflict(['type:task', 'status:in-progress', 'priority:P1']);
  assert.equal(r.hasConflict, false);
});

test('#1380 no status labels → hasConflict false', () => {
  const r = resolveTerminalConflict(['type:task', 'priority:P1']);
  assert.equal(r.hasConflict, false);
});
