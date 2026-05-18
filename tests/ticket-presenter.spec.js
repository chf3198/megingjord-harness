'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const P = require('../scripts/global/ticket-presenter.js');
const F = require('../scripts/global/ticket-presenter-format.js');

function mkIssue(num, opts = {}) {
  return {
    number: num, title: opts.title || `t${num}`, body: opts.body || '',
    labels: { nodes: (opts.labels || []).map(name => ({ name })) },
    parent: opts.parent ? { number: opts.parent } : null,
  };
}

test('isChild: native sub-issue parent detected', () => {
  assert.equal(P.isChild(mkIssue(1, { parent: 99 }), {}), true);
});

test('isChild: prose Refs to OPEN Epic counts as child', () => {
  const i = mkIssue(1, { body: 'Refs Epic #99' });
  assert.equal(P.isChild(i, { 99: 'OPEN' }), true);
});

test('isChild: prose Refs to CLOSED Epic does NOT count as child', () => {
  const i = mkIssue(1, { body: 'Refs Epic #99' });
  assert.equal(P.isChild(i, { 99: 'CLOSED' }), false);
});

test('isChild: no parent + no Refs is independent', () => {
  assert.equal(P.isChild(mkIssue(1), {}), false);
});

test('partition: sorts Epics by priority then status', () => {
  const items = [
    mkIssue(1, { labels: ['type:epic', 'priority:P2', 'status:backlog'] }),
    mkIssue(2, { labels: ['type:epic', 'priority:P1', 'status:backlog'] }),
    mkIssue(3, { labels: ['type:epic', 'priority:P1', 'status:in-progress'] }),
  ];
  const { epics } = P.partition(items, {});
  assert.deepEqual(epics.map(e => e.number), [3, 2, 1]);
});

test('partition: independents separated from epics', () => {
  const items = [
    mkIssue(1, { labels: ['type:epic', 'priority:P2'] }),
    mkIssue(2, { labels: ['type:task', 'priority:P2'] }),
  ];
  const { epics, indeps } = P.partition(items, {});
  assert.deepEqual(epics.map(e => e.number), [1]);
  assert.deepEqual(indeps.map(t => t.number), [2]);
});

test('partition: child tickets excluded', () => {
  const items = [
    mkIssue(1, { labels: ['type:task', 'priority:P2'], parent: 99 }),
    mkIssue(2, { labels: ['type:task', 'priority:P2'] }),
  ];
  const { indeps } = P.partition(items, {});
  assert.deepEqual(indeps.map(t => t.number), [2]);
});

test('priOf defaults to P3 when missing', () => {
  assert.equal(P.priOf(['type:task']), 'priority:P3');
});

test('statusOf returns ? when no status label', () => {
  assert.equal(P.statusOf(['type:task', 'priority:P2']), '?');
});

test('typeOf detects type label', () => {
  assert.equal(P.typeOf(['type:epic']), 'epic');
  assert.equal(P.typeOf(['type:task']), 'task');
});

test('detectObservations: multi-status flagged', () => {
  const items = [mkIssue(1, { labels: ['status:backlog', 'status:done'] })];
  const obs = F.detectObservations(items, {}, { labelsOf: P.labelsOf });
  assert.ok(obs.some(o => o.includes('multi-status')));
});

test('detectObservations: no-status flagged', () => {
  const items = [mkIssue(1, { labels: ['type:bug', 'priority:P2'] })];
  const obs = F.detectObservations(items, {}, { labelsOf: P.labelsOf });
  assert.ok(obs.some(o => o.includes('no-status')));
});

test('detectObservations: orphan-child (parent CLOSED) flagged', () => {
  const items = [mkIssue(1, { body: 'Refs Epic #99', labels: ['type:task'] })];
  const obs = F.detectObservations(items, { 99: 'CLOSED' }, { labelsOf: P.labelsOf });
  assert.ok(obs.some(o => o.includes('orphan-child')));
});

test('detectObservations: role-on-terminal flagged', () => {
  const items = [mkIssue(1, { labels: ['role:manager', 'status:done'] })];
  const obs = F.detectObservations(items, {}, { labelsOf: P.labelsOf });
  assert.ok(obs.some(o => o.includes('terminal status')));
});

test('formatMarkdown produces section headers + total', () => {
  const util = { labelsOf: P.labelsOf, priOf: P.priOf, statusOf: P.statusOf, typeOf: P.typeOf };
  const md = F.formatMarkdown({ totalOpen: 0, epics: [], indeps: [], parentMap: {} }, util);
  assert.match(md, /# Open Tickets Landscape/);
  assert.match(md, /Total open.*: 0/);
  assert.match(md, /## Open Epics/);
  assert.match(md, /## Open Independent Tickets — P1/);
});

test('buildReport with filter epics-only excludes independents', () => {
  const items = [
    mkIssue(1, { labels: ['type:epic', 'priority:P2'] }),
    mkIssue(2, { labels: ['type:task', 'priority:P2'] }),
  ];
  const r = P.buildReport({ items, parentMap: {}, filter: 'epics-only' });
  assert.equal(r.epics.length, 1);
  assert.equal(r.indeps.length, 0);
});

test('buildReport with filter independents-only excludes epics', () => {
  const items = [
    mkIssue(1, { labels: ['type:epic', 'priority:P2'] }),
    mkIssue(2, { labels: ['type:task', 'priority:P2'] }),
  ];
  const r = P.buildReport({ items, parentMap: {}, filter: 'independents-only' });
  assert.equal(r.epics.length, 0);
  assert.equal(r.indeps.length, 1);
});

test('constants are sane', () => {
  assert.equal(P.PRI['priority:P1'], 1);
  assert.equal(P.ST['status:in-progress'], 0);
  assert.equal(P.ST['status:done'], undefined);
});
