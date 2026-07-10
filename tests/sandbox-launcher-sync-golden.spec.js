// Golden-file regression guard for the Sandbox Launcher Sync gap (#3734).
//
// Root cause it locks down: .github/workflows/post-merge-sandbox-sync.yml carried
// a HARDCODED 3-branch subset (copilot/codex/claude-code) while
// scripts/global/worktree-governance-audit.js validated all five catalog runtimes.
// sandbox/antigravity + sandbox/cursor fell behind main every merge and bricked
// worktree-governance-required. This test fails if the two lists ever drift again.
const fs = require('fs');
const path = require('path');
const { test, expect } = require('@playwright/test');

const { sandboxLauncherTargets, sandboxLauncherBranches, FALLBACK } =
  require('../scripts/global/sandbox-launcher-targets');
const audit = require('../scripts/global/worktree-governance-audit');

const WORKFLOW = path.join(__dirname, '..', '.github', 'workflows', 'post-merge-sandbox-sync.yml');
const workflowSrc = fs.readFileSync(WORKFLOW, 'utf8');
const GOLDEN = JSON.parse(
  fs.readFileSync(path.join(__dirname, 'fixtures', 'sandbox-launcher-targets.golden.json'), 'utf8'),
);

test('#3734: helper + audit both match the golden launcher fixture', () => {
  // Golden file is the deliberate expected set; changing the catalog must update it.
  expect(sandboxLauncherTargets()).toEqual(GOLDEN.targets);
  expect(sandboxLauncherBranches()).toEqual(GOLDEN.branches);
});

test('#3734: sync list == audit validTargets (one SSoT, cannot drift)', () => {
  expect(sandboxLauncherTargets()).toEqual(audit.validTargets);
});

test('#3734: the two previously-omitted launchers are in the derived sync set', () => {
  const branches = sandboxLauncherBranches();
  expect(branches).toContain('sandbox/antigravity');
  expect(branches).toContain('sandbox/cursor');
});

test('#3734: derived branches are exactly validTargets mapped to sandbox/*', () => {
  const expected = audit.validTargets.map((t) => `sandbox/${t}`);
  expect(sandboxLauncherBranches()).toEqual(expected);
});

test('#3734: fallback covers all five launchers (catalog-unreadable path)', () => {
  expect(FALLBACK).toEqual(['antigravity', 'claude-code', 'codex', 'copilot', 'cursor']);
});

test('#3734: workflow derives its list from the shared helper, not a hardcoded subset', () => {
  // Must require the shared SSoT helper...
  expect(workflowSrc).toContain("require('./scripts/global/sandbox-launcher-targets')");
  expect(workflowSrc).toContain('sandboxLauncherBranches()');
  // ...and must check out the repo first so the require() resolves at runtime.
  expect(workflowSrc).toMatch(/uses:\s*actions\/checkout@[a-f0-9]{40}/);
  // The old hardcoded literal subset must be gone (regression anchor).
  expect(workflowSrc).not.toContain("'sandbox/copilot',\n              'sandbox/codex',");
});
