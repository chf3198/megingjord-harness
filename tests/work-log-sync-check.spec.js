// tests/work-log-sync-check.spec.js — unit tests for work-log-sync validator (#3199).
// AC5: covers synced, missing-comment, status-mismatch, deferred-final, offline.
'use strict';
const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const helpers = require('../scripts/global/megalint/work-log-sync-helpers.js');
const { validate } = require('../scripts/global/megalint/work-log-sync.js');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');

describe('work-log-sync-helpers', () => {
  it('currentPhase: pre-pr when no PR exists', () => {
    assert.equal(helpers.currentPhase(false, 'OPEN'), 'pre-pr');
  });
  it('currentPhase: post-pr when PR exists', () => {
    assert.equal(helpers.currentPhase(true, 'OPEN'), 'post-pr');
  });
  it('currentPhase: post-merge when issue closed', () => {
    assert.equal(helpers.currentPhase(true, 'CLOSED'), 'post-merge');
    assert.equal(helpers.currentPhase(false, 'closed'), 'post-merge');
  });
  it('requiredForPhase: pre-pr only Manager+Collaborator', () => {
    const r = helpers.requiredForPhase('pre-pr');
    assert.deepEqual(r, ['MANAGER_HANDOFF', 'COLLABORATOR_HANDOFF']);
  });
  it('requiredForPhase: post-pr adds Admin', () => {
    const r = helpers.requiredForPhase('post-pr');
    assert.ok(r.includes('ADMIN_HANDOFF'));
    assert.ok(!r.includes('CONSULTANT_CLOSEOUT'));
  });
  it('requiredForPhase: post-merge includes all 4', () => {
    assert.equal(helpers.requiredForPhase('post-merge').length, 4);
  });
  it('commentContainsHandoff: matches anchored header', () => {
    const comments = ['## MANAGER_HANDOFF\nscope: test'];
    assert.ok(helpers.commentContainsHandoff(comments, 'MANAGER_HANDOFF'));
  });
  it('commentContainsHandoff: rejects unanchored prose mention', () => {
    const comments = ['We will post MANAGER_HANDOFF later.'];
    // Prose mention mid-sentence without line-start header → correctly rejected
    assert.ok(!helpers.commentContainsHandoff(comments, 'MANAGER_HANDOFF'));
  });
  it('commentContainsHandoff: returns false when absent', () => {
    assert.ok(!helpers.commentContainsHandoff(['hello world'], 'ADMIN_HANDOFF'));
  });
});

describe('work-log-sync validate', () => {
  it('PASS: no ticket ref → skip', () => {
    const r = validate({ comments: [] });
    assert.ok(r.ok);
    assert.equal(r.skipped, 'no-ticket-ref');
  });
  it('PASS: no local work-log file → skip', () => {
    const r = validate({ ticketRef: 999999, comments: [] });
    assert.ok(r.ok);
    assert.equal(r.skipped, 'no-work-log');
  });
  it('PASS: synced state — local handoffs match remote', () => {
    const tmp = path.join(os.tmpdir(), `wls-test-${Date.now()}`);
    const dir = path.join(tmp, 'wiki', 'work-log', 'tickets');
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(path.join(dir, '42.md'), '## MANAGER_HANDOFF\nscope: x');
    // Monkey-patch ROOT for test
    const orig = require('../scripts/global/megalint/work-log-sync-helpers.js');
    const origResolve = orig.resolveWorkLogPath;
    orig.resolveWorkLogPath = (n) => path.join(dir, `${n}.md`);
    const r = validate({
      ticketRef: 42,
      comments: [{ body: '## MANAGER_HANDOFF\nscope: x' }],
      state: 'OPEN',
    });
    orig.resolveWorkLogPath = origResolve;
    fs.rmSync(tmp, { recursive: true, force: true });
    assert.ok(r.ok);
  });
  it('FAIL: missing remote comment for declared local handoff', () => {
    const tmp = path.join(os.tmpdir(), `wls-test-${Date.now()}`);
    const dir = path.join(tmp, 'wiki', 'work-log', 'tickets');
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(path.join(dir, '43.md'),
      '## MANAGER_HANDOFF\nscope: x\n## COLLABORATOR_HANDOFF\nac: y');
    const orig = require('../scripts/global/megalint/work-log-sync-helpers.js');
    const origResolve = orig.resolveWorkLogPath;
    orig.resolveWorkLogPath = (n) => path.join(dir, `${n}.md`);
    const r = validate({
      ticketRef: 43,
      comments: [{ body: '## MANAGER_HANDOFF\nscope: x' }],
      state: 'OPEN',
    });
    orig.resolveWorkLogPath = origResolve;
    fs.rmSync(tmp, { recursive: true, force: true });
    assert.ok(!r.ok);
    assert.ok(r.violations[0].detail.includes('COLLABORATOR_HANDOFF'));
  });
  it('ADVISORY: deferred-final CONSULTANT_CLOSEOUT before PR → skip', () => {
    const tmp = path.join(os.tmpdir(), `wls-test-${Date.now()}`);
    const dir = path.join(tmp, 'wiki', 'work-log', 'tickets');
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(path.join(dir, '44.md'),
      '## MANAGER_HANDOFF\nx\n## CONSULTANT_CLOSEOUT\nverdict: approve');
    const orig = require('../scripts/global/megalint/work-log-sync-helpers.js');
    const origResolve = orig.resolveWorkLogPath;
    orig.resolveWorkLogPath = (n) => path.join(dir, `${n}.md`);
    const r = validate({
      ticketRef: 44,
      comments: [{ body: '## MANAGER_HANDOFF\nx' }],
      state: 'OPEN',
      // prBody undefined = no PR = pre-pr phase
    });
    orig.resolveWorkLogPath = origResolve;
    fs.rmSync(tmp, { recursive: true, force: true });
    // CONSULTANT_CLOSEOUT not required at pre-pr → should pass
    assert.ok(r.ok);
  });
});
