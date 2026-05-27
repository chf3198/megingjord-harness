'use strict';
// tests/epic-task-list-auto-tick.spec.js — tdd-pyramid coverage for #1337.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const {
  findChildRef, isAlreadyTicked, tickChildRef, discoverParents,
} = require('../scripts/global/epic-task-list-auto-tick');

test('findChildRef matches typed child-ref task-list line', () => {
  const body = '- [ ] #1309 — Codify three-tier anneal protocol\n';
  assert.ok(findChildRef(body, 1309));
});

test('findChildRef does NOT match prose ticket mention inside an AC', () => {
  const body = '- [ ] **AC4** When events accumulate, cooperates with #1220 suppression registry — does NOT re-file.\n';
  assert.equal(findChildRef(body, 1220), null);
});

test('findChildRef returns null for missing N', () => {
  assert.equal(findChildRef('# Epic\nNo children listed\n', 1309), null);
});

test('findChildRef rejects malformed input gracefully', () => {
  assert.equal(findChildRef('', 1), null);
  assert.equal(findChildRef(null, 1), null);
  assert.equal(findChildRef('valid', null), null);
  assert.equal(findChildRef('valid', 0), null);
});

test('tickChildRef flips unticked to ticked and is idempotent', () => {
  const body = '- [ ] #1309 — Codify three-tier anneal protocol\n';
  const r1 = tickChildRef(body, 1309);
  assert.equal(r1.changed, true);
  assert.equal(r1.reason, 'ticked');
  assert.match(r1.body, /^- \[x\] #1309 —/);
  const r2 = tickChildRef(r1.body, 1309);
  assert.equal(r2.changed, false);
  assert.equal(r2.reason, 'already-ticked');
});

test('tickChildRef is a no-op on prose mention', () => {
  const body = '- [ ] AC4 cooperates with #1220 suppression\n';
  const r = tickChildRef(body, 1220);
  assert.equal(r.changed, false);
  assert.equal(r.reason, 'no-match');
});

test('tickChildRef preserves all other lines unchanged', () => {
  const body = '# Epic header\n\n- [x] #1309 — done\n- [ ] #1310 — pending\n- [ ] #1311 — pending\n';
  const r = tickChildRef(body, 1310);
  assert.equal(r.changed, true);
  assert.match(r.body, /- \[x\] #1310 — pending/);
  assert.match(r.body, /- \[x\] #1309 — done/);
  assert.match(r.body, /- \[ \] #1311 — pending/);
});

test('discoverParents finds typed-ref Epics and skips prose-only', () => {
  const epics = [
    { number: 1308, body: '- [ ] #1309 — child\n' },
    { number: 1339, body: 'Cooperates with #1309 suppression registry\n' },
    { number: 1771, body: '## ACs\n- [x] AC1\n' },
  ];
  const found = discoverParents(epics, 1309);
  assert.equal(found.length, 1);
  assert.equal(found[0].number, 1308);
});

test('discoverParents handles em-dash, hyphen, and colon separators', () => {
  const epics = [
    { number: 100, body: '- [ ] #200 — em-dash\n' },
    { number: 101, body: '- [ ] #200 - hyphen-with-space\n' },
    { number: 102, body: '- [ ] #200: colon-no-space\n' },
    { number: 103, body: '- [ ] #200- hyphen-no-space\n' },
  ];
  assert.equal(discoverParents(epics, 200).length, 4);
});

test('isAlreadyTicked recognizes ticked-vs-unticked correctly', () => {
  assert.equal(isAlreadyTicked('- [x] #99 — done\n', 99), true);
  assert.equal(isAlreadyTicked('- [ ] #99 — pending\n', 99), false);
  assert.equal(isAlreadyTicked('- [X] #99 — uppercase\n', 99), false);
});

test('tickChildRef does NOT accidentally tick a longer child number that contains the closed N', () => {
  const body = '- [ ] #1309 — closed child\n- [ ] #13090 — different child sharing prefix\n';
  const r = tickChildRef(body, 1309);
  assert.equal(r.changed, true);
  assert.match(r.body, /^- \[x\] #1309 —/m);
  assert.match(r.body, /^- \[ \] #13090 —/m);
});
