#!/usr/bin/env node
'use strict';
// #3357 — stress: concurrent teardown + fault-injection (G6) + p99 budget (G7). Epic #3352 C2.
const { test, expect } = require('@playwright/test');
const { actuate } = require('../scripts/global/worktree-teardown-actuate');

const P99_BUDGET_MS = 250;            // p99 wall-clock budget for a 200-worktree actuation
const CONCURRENCY = 25;
const FLEET_SIZE = 200;

const makePlan = (count) => ({ worktrees: Array.from({ length: count }, (_, index) => ({
  path: `/tmp/wt-${index}`, branch: `feat/${index + 1}-x`, ticket: index + 1,
  cleanupState: 'remove', squashMerged: true })) });

test('AC2.5 concurrent invocations race the same plan without crashing or double-removing', async () => {
  const removedPaths = new Set();
  // first invocation to reach a path removes it; later ones get a dirty-guard-style refusal.
  const runRemove = (path) => {
    if (removedPaths.has(path)) return { ok: false, exitCode: 1, stderr: 'No such worktree (already removed)' };
    removedPaths.add(path); return { ok: true, exitCode: 0, stderr: '' };
  };
  const plan = makePlan(20);
  const results = await Promise.all(Array.from({ length: CONCURRENCY }, () =>
    Promise.resolve().then(() => actuate({ apply: true, plan, runRemove, emit: () => {}, currentPath: '/x' }))));
  // exactly the 20 unique worktrees removed across all racers; the rest refused; nothing thrown.
  const totalRemoved = results.reduce((sum, r) => sum + r.removed.length, 0);
  expect(removedPaths.size).toBe(20);
  expect(totalRemoved).toBe(20);
});

test('AC2.5 fault-injection: a throwing remover becomes a captured refusal, never a crash', () => {
  let toggle = 0;
  const runRemove = () => { toggle += 1; if (toggle % 2 === 0) throw new Error('git exploded'); return { ok: true, exitCode: 0, stderr: '' }; };
  const result = actuate({ apply: true, plan: makePlan(10), runRemove, emit: () => {}, currentPath: '/x' });
  expect(result.removed.length + result.refused.length).toBe(10); // all accounted, none lost
  expect(result.refused.length).toBeGreaterThan(0);
});

test('AC2.5 p99 latency budget: 200-worktree actuation stays under budget', () => {
  const runRemove = () => ({ ok: true, exitCode: 0, stderr: '' });
  const durations = [];
  for (let iteration = 0; iteration < 20; iteration += 1) {
    const start = process.hrtime.bigint();
    actuate({ apply: true, plan: makePlan(FLEET_SIZE), runRemove, emit: () => {}, currentPath: '/x' });
    durations.push(Number(process.hrtime.bigint() - start) / 1e6);
  }
  durations.sort((left, right) => left - right);
  const p99 = durations[Math.min(durations.length - 1, Math.floor(durations.length * 0.99))];
  expect(p99).toBeLessThan(P99_BUDGET_MS);
});
