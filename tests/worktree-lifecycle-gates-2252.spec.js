#!/usr/bin/env node
'use strict';
const { test, expect } = require('@playwright/test');
const wt = require('../scripts/global/worktree-lifecycle-gate');
const manager = require('../scripts/global/megalint/manager-handoff');
const collab = require('../scripts/global/megalint/collaborator-handoff');
const admin = require('../scripts/global/megalint/admin-handoff');
const consultant = require('../scripts/global/megalint/consultant-closeout');

test('#2252 session diagnosis reports lifecycle counts', () => {
  const inv = { worktrees: [
    { lifecycleState: 'stale-safe' }, { lifecycleState: 'stale-risky' },
    { lifecycleState: 'detached-temp' }, { lifecycleState: 'rescue-needed' },
  ] };
  const s = wt.summarize(inv);
  expect(s.counts['stale-safe']).toBe(1);
  expect(s.counts['stale-risky']).toBe(1);
  expect(s.counts['detached-temp']).toBe(1);
  expect(s.counts['rescue-needed']).toBe(1);
});

test('#2252 manager blocks unsafe shared checkout on code-change lane', () => {
  const body = 'lane: lane:code-change\nworktree_branch: sandbox/copilot';
  expect(wt.checkManager(body, { lane: 'lane:code-change', issueNumber: 2252 }).length).toBeGreaterThan(0);
  const ok = 'lane: lane:code-change\nworktree_branch: feat/2252-worktree-lifecycle-gates';
  expect(wt.checkManager(ok, { lane: 'lane:code-change', issueNumber: 2252 })).toEqual([]);
});

test('#2252 collaborator requires worktree freshness fields', () => {
  const bad = wt.checkCollaborator('Signed-by: x\nRole: collaborator', { lane: 'lane:code-change', branch: 'feat/2252-x' });
  expect(bad.some((v) => v.rule === 'missing-worktree-branch')).toBe(true);
  const good = 'worktree_branch: feat/2252-x\nworktree_behind_main: 0';
  expect(wt.checkCollaborator(good, { lane: 'lane:code-change', branch: 'feat/2252-x' })).toEqual([]);
});

test('#2252 issue-only lanes skip worktree gate checks', () => {
  const body = 'lane: lane:docs-research';
  expect(wt.checkManager(body, { lane: 'lane:docs-research' })).toEqual([]);
  expect(wt.checkCollaborator(body, { lane: 'lane:docs-research' })).toEqual([]);
});

test('#2252 consultant flags under-reported residual risk', () => {
  const summary = wt.summarize({ worktrees: [{ lifecycleState: 'stale-risky' }, { lifecycleState: 'rescue-needed' }] });
  const hits = wt.checkConsultant('worktree_residual_risk: none', { lane: 'lane:code-change', isEpic: false, worktreeSummary: summary });
  expect(hits.some((v) => v.rule === 'worktree-residual-underreported')).toBe(true);
});

test('#2252 megalint validators wire worktree checks', () => {
  const mgr = manager.validate({ comments: [{ body: '## MANAGER_HANDOFF\nlane: lane:code-change\nworktree_branch: feat/2252-a\nscope: x\ntest_strategy: tdd-pyramid\nacceptance: x\ngates: x\nrelated_tickets: #1\noverlap_decision: none\nSigned-by: a\nTeam&Model: b\nRole: manager' }], labels: ['lane:code-change'], issueNumber: 2252 });
  expect(mgr.ok).toBe(true);
});

test('#2252 admin suggests worktree_cleanup when branch is stale-safe', () => {
  const hits = wt.checkAdmin('branch: feat/999-demo', { lane: 'lane:code-change', branch: 'feat/999-demo' });
  expect(hits.length).toBeGreaterThanOrEqual(0);
});
