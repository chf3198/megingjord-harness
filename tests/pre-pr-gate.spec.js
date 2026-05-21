'use strict';
process.env.NODE_ENV = 'test';
const test = require('node:test');
const assert = require('node:assert/strict');
const G = require('../scripts/global/pre-pr-gate.js');

function mkComment(kind, ageSec = 100) {
  return { body: `## ${kind}\nticket: #N`, createdAt: new Date(Date.now() - ageSec * 1000).toISOString() };
}

test('extractLeadTicket: feat branch', () => assert.equal(G.extractLeadTicket('feat/1234-foo-bar'), 1234));
test('extractLeadTicket: fix branch', () => assert.equal(G.extractLeadTicket('fix/9-quick'), 9));
test('extractLeadTicket: hotfix branch', () => assert.equal(G.extractLeadTicket('hotfix/100-x'), 100));
test('extractLeadTicket: chore branch', () => assert.equal(G.extractLeadTicket('chore/55-cleanup'), 55));
test('extractLeadTicket: skill branch', () => assert.equal(G.extractLeadTicket('skill/77-name'), 77));
test('extractLeadTicket: main returns null', () => assert.equal(G.extractLeadTicket('main'), null));
test('extractLeadTicket: malformed returns null', () => assert.equal(G.extractLeadTicket('refactor/1-x'), null));

test('checkBatonCompleteness: all 4 present passes', () => {
  const comments = G.ARTIFACTS.map(kind => mkComment(kind));
  assert.equal(G.checkBatonCompleteness(comments), null);
});

test('checkBatonCompleteness: missing one fails', () => {
  const comments = [mkComment('MANAGER_HANDOFF'), mkComment('COLLABORATOR_HANDOFF'), mkComment('ADMIN_HANDOFF')];
  const result = G.checkBatonCompleteness(comments);
  assert.equal(result.rule, 'baton-incomplete');
  assert.match(result.detail, /CONSULTANT_CLOSEOUT/);
});

test('checkBatonCompleteness: empty fails with all 4', () => {
  const result = G.checkBatonCompleteness([]);
  assert.equal(result.rule, 'baton-incomplete');
  assert.match(result.detail, /4 baton/);
});

test('checkPredateWindow: COLLAB >60s ago passes', () => {
  const comments = [mkComment('COLLABORATOR_HANDOFF', 100)];
  assert.equal(G.checkPredateWindow(comments, Date.now()), null);
});

test('checkPredateWindow: COLLAB <60s ago fails with wait time', () => {
  const comments = [mkComment('COLLABORATOR_HANDOFF', 30)];
  const result = G.checkPredateWindow(comments, Date.now());
  assert.equal(result.rule, 'predate-window-not-elapsed');
  assert.match(result.detail, /Wait/);
});

test('checkPredateWindow: no COLLAB returns null (covered by baton check)', () => {
  assert.equal(G.checkPredateWindow([], Date.now()), null);
});

test('checkClosesKeyword: both present passes', () => {
  const body = 'Refs #1234\nCloses #1234\n\nSummary...';
  assert.equal(G.checkClosesKeyword(body, 1234), null);
});

test('checkClosesKeyword: missing Closes fails', () => {
  const result = G.checkClosesKeyword('Refs #1234\n\nSummary', 1234);
  assert.match(result.detail, /Closes #1234/);
});

test('checkClosesKeyword: missing Refs fails', () => {
  const result = G.checkClosesKeyword('Closes #1234\n\nSummary', 1234);
  assert.match(result.detail, /Refs #1234/);
});

test('checkClosesKeyword: Fixes is accepted as Closes-equivalent', () => {
  assert.equal(G.checkClosesKeyword('Refs #1234\nFixes #1234', 1234), null);
});

test('checkClosesKeyword: undefined body skips check', () => {
  assert.equal(G.checkClosesKeyword(undefined, 1234), null);
});

test('check: non-feat branch skips', () => {
  const result = G.check({ branch: 'main', comments: [] });
  assert.equal(result.ok, true);
  assert.equal(result.skipped, 'non-feat-branch');
});

test('check: feat branch + all 4 baton + COLLAB old + body OK = PASS', () => {
  const comments = G.ARTIFACTS.map(kind => mkComment(kind, 100));
  const result = G.check({ branch: 'feat/1234-x', comments, prBodyDraft: 'Refs #1234\nCloses #1234' });
  assert.equal(result.ok, true);
  assert.deepEqual(result.violations, []);
});

test('check: missing artifacts AND short predate AND missing Closes = 3 violations', () => {
  const comments = [mkComment('MANAGER_HANDOFF'), mkComment('COLLABORATOR_HANDOFF', 30)];
  const result = G.check({ branch: 'feat/1234-x', comments, prBodyDraft: 'Refs #1234' });
  assert.equal(result.ok, false);
  assert.equal(result.violations.length, 3);
});

test('constants are sane', () => {
  assert.equal(G.PREDATE_WINDOW_SECONDS, 60);
  assert.deepEqual(G.ARTIFACTS, ['MANAGER_HANDOFF', 'COLLABORATOR_HANDOFF', 'ADMIN_HANDOFF', 'CONSULTANT_CLOSEOUT']);
});
