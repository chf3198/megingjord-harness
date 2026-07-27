'use strict';
// #3858 (Epic #3854 GAP-B) — verify-don't-trust worktree freshness.
const test = require('node:test');
const assert = require('node:assert');
const path = require('node:path');
const G = path.join(__dirname, '..', 'scripts', 'global');
const fresh = require(path.join(G, 'git-freshness-check.js'));
const wlg = require(path.join(G, 'worktree-lifecycle-gate.js'));
const rf = require(path.join(G, 'collab-handoff-rebase-freshness.js'));

test('git-freshness exports fetch-before-count helpers', () => {
  assert.strictEqual(typeof fresh.behindCountFresh, 'function');
  assert.strictEqual(typeof fresh.fetchBase, 'function');
});

test('fetchBase is fail-open (never throws, even on a bogus remote base)', () => {
  assert.doesNotThrow(() => fresh.fetchBase('nonexistent-remote-xyz/nope'));
});

test('evaluate with injected behind classifies via tiers (no git needed)', () => {
  assert.strictEqual(fresh.evaluate({ branch: 'feat/1-x', behind: 2, branchCommits: 5, velocity: 5 }).tier, 'ok');
  assert.strictEqual(fresh.evaluate({ branch: 'feat/1-x', behind: 50, branchCommits: 5, velocity: 5 }).tier, 're-scope');
});

const CODE = { lane: 'lane:code-change' };
const body = (b) => `worktree_branch: feat/3858-x\nworktree_behind_main: ${b}\n`;

test('checkCollaborator: declared==actual → no freshness violation', () => {
  const out = wlg.checkCollaborator(body(0), { ...CODE, branch: 'feat/3858-x', actualBehind: 0 });
  assert.ok(!out.some((v) => v.rule === 'worktree-behind-declared-mismatch'));
});

test('checkCollaborator: declared!=actual → mismatch (verify-don\'t-trust)', () => {
  const out = wlg.checkCollaborator(body(0), { ...CODE, branch: 'feat/3858-x', actualBehind: 4 });
  assert.ok(out.some((v) => v.rule === 'worktree-behind-declared-mismatch'));
});

test('checkCollaborator: small actual behind (1-2) does NOT block (anti-#1771 absolute-threshold)', () => {
  const out = wlg.checkCollaborator(body(2), { ...CODE, branch: 'feat/3858-x', actualBehind: 2 });
  assert.strictEqual(out.length, 0, JSON.stringify(out));
});

test('checkCollaborator: actual above tier ceiling (30) → exceeds-tier', () => {
  const out = wlg.checkCollaborator(body(31), { ...CODE, branch: 'feat/3858-x', actualBehind: 31 });
  assert.ok(out.some((v) => v.rule === 'worktree-behind-exceeds-tier'));
});

test('checkCollaborator: recompute unavailable (actual=null) → fail-open, no freshness violation', () => {
  // no actualBehind injected + branch that cannot resolve → recompute returns null
  const out = wlg.checkCollaborator(body(0), { ...CODE, branch: 'feat/3858-nonexistent-branch-zzz' });
  assert.ok(!out.some((v) => v.rule === 'worktree-behind-declared-mismatch' || v.rule === 'worktree-behind-exceeds-tier'));
});

test('recomputeBehind honors injected actualBehind', () => {
  assert.strictEqual(wlg.recomputeBehind('feat/3858-x', { actualBehind: 7 }), 7);
});

test('rebase-freshness: actualBehind mismatch → declared-mismatch violation', () => {
  const r = rf.validate('behind_at_handoff: 0\nrebase_freshness: 2026-07-27T20:00:00Z', { actualBehind: 5, now: Date.parse('2026-07-27T20:01:00Z') });
  assert.ok(r.violations.some((v) => v.rule === 'behind-at-handoff-declared-mismatch'));
});

test('rebase-freshness: declared==actual small value → ok (no bare >0 reject)', () => {
  const r = rf.validate('behind_at_handoff: 2\nrebase_freshness: 2026-07-27T20:00:00Z', { actualBehind: 2, now: Date.parse('2026-07-27T20:01:00Z') });
  assert.strictEqual(r.ok, true, JSON.stringify(r.violations));
});

test('rebase-freshness: tier ceiling (30) still enforced', () => {
  const r = rf.validate('behind_at_handoff: 31\nrebase_freshness: 2026-07-27T20:00:00Z', { now: Date.parse('2026-07-27T20:01:00Z') });
  assert.ok(r.violations.some((v) => v.rule === 'behind-at-handoff-exceeds-rescope-tier'));
});
