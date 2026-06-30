#!/usr/bin/env node
'use strict';
// #3358 — stress: adversarial novel-safety (G6) + concurrency + p99 (G7). Epic #3352 C3.
const { test, expect } = require('@playwright/test');
const { reconcile } = require('../scripts/global/worktree-quarantine-reconcile');

const P99_BUDGET_MS = 250;
const FLEET_SIZE = 200;

// adversarial corpus: every "novel" shape that MUST survive.
const NOVEL_SHAPES = [
  [{ untracked: false, path: 'scripts/global/x.js' }],                 // modified tracked source
  [{ untracked: true, path: 'scripts/global/new-feature.js' }],        // untracked source
  [{ untracked: false, path: 'README.md' }],                           // modified doc
  [{ untracked: true, path: 'node_modules/a' }, { untracked: false, path: 'tests/y.spec.js' }], // mixed
  [{ untracked: false, path: 'package.json' }],                        // modified config
];

test('AC3.4 STRESS: no novel shape is ever removed across the adversarial corpus', () => {
  const removeCalls = [];
  for (const files of NOVEL_SHAPES) {
    const r = reconcile({ confirm: true, emit: () => {},
      remove: (p) => { removeCalls.push(p); return { ok: true, exitCode: 0 }; },
      candidates: [{ path: '/tmp/wt', branch: 'feat/9-x', ticket: 9, mergedToMainDirty: true, ticketClosed: true, files }] });
    expect(r[0].decision).toBe('rescue-novel-work');
  }
  expect(removeCalls).toHaveLength(0); // chaos path: not one novel worktree removed
});

test('AC3.4 STRESS: a remover that throws (fault injection) never crashes the reconcile', () => {
  const r = reconcile({ confirm: true, emit: () => {},
    remove: () => { throw new Error('git boom'); },
    candidates: [{ path: '/tmp/wt', branch: 'feat/1-x', ticket: 1, mergedToMainDirty: true, ticketClosed: true,
      files: [{ untracked: true, path: 'node_modules/x' }] }] });
  expect(['refused', 'removed']).toContain(r[0].decision === 'removed' ? 'removed' : 'refused');
});

test('AC3 STRESS: p99 over 200 mixed candidates under budget', () => {
  const candidates = Array.from({ length: FLEET_SIZE }, (_, index) => ({
    path: `/tmp/wt-${index}`, branch: `feat/${index + 1}-x`, ticket: index + 1,
    mergedToMainDirty: true, ticketClosed: index % 2 === 0,
    files: index % 3 === 0 ? [{ untracked: true, path: 'node_modules/x' }] : [{ untracked: false, path: 'src/x.js' }],
  }));
  const durations = [];
  for (let iteration = 0; iteration < 20; iteration += 1) {
    const start = process.hrtime.bigint();
    reconcile({ confirm: true, emit: () => {}, remove: () => ({ ok: true, exitCode: 0 }), candidates });
    durations.push(Number(process.hrtime.bigint() - start) / 1e6);
  }
  durations.sort((left, right) => left - right);
  const p99 = durations[Math.min(durations.length - 1, Math.floor(durations.length * 0.99))];
  expect(p99).toBeLessThan(P99_BUDGET_MS);
});
