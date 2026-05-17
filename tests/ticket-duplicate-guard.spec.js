'use strict';

const assert = require('node:assert/strict');
const { test } = require('node:test');
const {
  normalizeTitle, withinWindow, findRapidDuplicates, checkMode, scanMode, parseArgs,
} = require('../scripts/global/ticket-duplicate-guard.js');

function iso(secondsAgo) {
  return new Date(Date.now() - secondsAgo * 1000).toISOString();
}

test('normalizeTitle handles whitespace, case, and punctuation', () => {
  assert.equal(normalizeTitle('  Fix: Bug ! '), 'fix bug');
  assert.equal(normalizeTitle('SAME-TITLE  HERE'), 'same-title here');
  assert.equal(normalizeTitle('Fix bug,'), 'fix bug');
  assert.equal(normalizeTitle(''), '');
});

test('withinWindow detects times within and outside window', () => {
  assert.equal(withinWindow('2026-05-17T03:00:00Z', '2026-05-17T03:00:05Z', 10), true);
  assert.equal(withinWindow('2026-05-17T03:00:00Z', '2026-05-17T03:15:00Z', 10), false);
});

test('findRapidDuplicates flags same-title pair within window', () => {
  const issues = [
    { number: 1700, title: 'Same title', createdAt: iso(60) },
    { number: 1701, title: 'Same title', createdAt: iso(55) },
  ];
  const pairs = findRapidDuplicates(issues, 10);
  assert.equal(pairs.length, 1);
  // Canonical = earlier-created (lower issue number when filed seconds apart).
  assert.equal(pairs[0].canonical.number, 1700);
  assert.equal(pairs[0].duplicate.number, 1701);
});

test('findRapidDuplicates ignores same-title pair outside window', () => {
  const issues = [
    { number: 100, title: 'Same title', createdAt: '2026-05-17T03:00:00Z' },
    { number: 101, title: 'Same title', createdAt: '2026-05-17T04:00:00Z' },
  ];
  const pairs = findRapidDuplicates(issues, 10);
  assert.equal(pairs.length, 0);
});

test('findRapidDuplicates does not flag different titles', () => {
  const issues = [
    { number: 1, title: 'Title A', createdAt: iso(60) },
    { number: 2, title: 'Title B', createdAt: iso(55) },
  ];
  assert.equal(findRapidDuplicates(issues, 10).length, 0);
});

test('checkMode finds existing match via injected issues', () => {
  const issues = [{ number: 999, title: 'Add cool feature', createdAt: iso(60), state: 'OPEN' }];
  const r = checkMode('Add cool feature', { issues });
  assert.equal(r.ok, false);
  assert.equal(r.canonical.number, 999);
});

test('checkMode passes when no match', () => {
  const r = checkMode('Brand new title', { issues: [] });
  assert.equal(r.ok, true);
  assert.equal(r.canonical, null);
});

test('scanMode envelope shape includes pattern_id + windowMin', () => {
  const r = scanMode({ issues: [], windowMin: 5 });
  assert.equal(r.ok, true);
  assert.equal(r.pattern_id, '1765-rapid-duplicate');
  assert.equal(r.windowMin, 5);
});

test('parseArgs handles --check, --scan, --json combinations', () => {
  assert.deepEqual(parseArgs(['--check', 'Some title']), { mode: 'check', title: 'Some title', json: false });
  assert.deepEqual(parseArgs(['--scan', '--json']), { mode: 'scan', title: null, json: true });
  assert.deepEqual(parseArgs([]), { mode: null, title: null, json: false });
});
