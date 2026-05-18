'use strict';

const assert = require('node:assert/strict');
const { test } = require('node:test');
const { evaluate, overlap, fmtHuman }
  = require('../scripts/global/git-conflict-predict.js');

test('overlap: empty intersection', () => {
  assert.deepEqual(overlap(['a', 'b'], ['c', 'd']), []);
});

test('overlap: full intersection', () => {
  assert.deepEqual(overlap(['a', 'b'], ['a', 'b']).sort(), ['a', 'b']);
});

test('overlap: partial intersection', () => {
  assert.deepEqual(overlap(['a', 'b', 'c'], ['b', 'c', 'd']).sort(), ['b', 'c']);
});

test('overlap: deduplicates', () => {
  assert.deepEqual(overlap(['a', 'a'], ['a', 'a']).sort(), ['a']);
});

test('evaluate: opt-out env var skips', () => {
  const prior = process.env.MEGINGJORD_REBASE_DISCIPLINE_DISABLED;
  process.env.MEGINGJORD_REBASE_DISCIPLINE_DISABLED = '1';
  try {
    const r = evaluate({ branch: 'feat/x', myFiles: ['a.js'],
      mockPRs: [{ number: 1, headRefName: 'feat/y', files: [{ path: 'a.js' }] }] });
    assert.equal(r.ok, true);
    assert.equal(r.skipped, 'opt-out-env-var');
  } finally {
    if (prior == null) delete process.env.MEGINGJORD_REBASE_DISCIPLINE_DISABLED;
    else process.env.MEGINGJORD_REBASE_DISCIPLINE_DISABLED = prior;
  }
});

test('evaluate: no changed files → ok', () => {
  const r = evaluate({ branch: 'feat/x', myFiles: [],
    mockPRs: [{ number: 1, headRefName: 'feat/y', files: [{ path: 'a.js' }] }] });
  assert.equal(r.ok, true);
  assert.equal(r.reason, 'no-changed-files');
});

test('evaluate: no overlap with other PRs → ok', () => {
  const r = evaluate({ branch: 'feat/x', myFiles: ['a.js'],
    mockPRs: [{ number: 1, headRefName: 'feat/y', files: [{ path: 'b.js' }] }] });
  assert.equal(r.ok, true);
  assert.equal(r.overlap_count, 0);
});

test('evaluate: overlap with single PR → not ok with details', () => {
  const r = evaluate({ branch: 'feat/x', myFiles: ['a.js', 'b.js'],
    mockPRs: [{ number: 1, headRefName: 'feat/y', files: [{ path: 'a.js' }, { path: 'c.js' }] }] });
  assert.equal(r.ok, false);
  assert.equal(r.overlap_count, 1);
  assert.equal(r.overlaps[0].pr, 1);
  assert.deepEqual(r.overlaps[0].shared_files, ['a.js']);
});

test('evaluate: multiple PRs with overlaps', () => {
  const r = evaluate({ branch: 'feat/x', myFiles: ['a.js', 'b.js'],
    mockPRs: [
      { number: 1, headRefName: 'feat/y', files: [{ path: 'a.js' }] },
      { number: 2, headRefName: 'feat/z', files: [{ path: 'b.js' }] },
    ] });
  assert.equal(r.overlap_count, 2);
});

test('evaluate: skips its own branch', () => {
  const r = evaluate({ branch: 'feat/x', myFiles: ['a.js'],
    mockPRs: [{ number: 1, headRefName: 'feat/x', files: [{ path: 'a.js' }] }] });
  assert.equal(r.ok, true);
  assert.equal(r.overlap_count, 0);
});

test('fmtHuman: ok case', () => {
  assert.match(fmtHuman({ ok: true, open_pr_count: 3 }), /no file overlap/);
});

test('fmtHuman: overlap case lists PRs + files', () => {
  const out = fmtHuman({ ok: false, overlap_count: 1,
    overlaps: [{ pr: 5, branch: 'feat/y', shared_files: ['a.js'], shared_count: 1 }] });
  assert.match(out, /PR #5/);
  assert.match(out, /a\.js/);
});

test('fmtHuman: truncates beyond 5 files with summary', () => {
  const shared = ['a', 'b', 'c', 'd', 'e', 'f', 'g'];
  const out = fmtHuman({ ok: false, overlap_count: 1,
    overlaps: [{ pr: 5, branch: 'feat/y', shared_files: shared, shared_count: 7 }] });
  assert.match(out, /\+2 more/);
});
