// tests/wiki-reconcile-cron-workflow.spec.js — golden-file regression guard for the
// daily wiki-reconcile-cron workflow (#3718). The 6-day whole-work-log freeze was
// caused by `git add wiki/ dashboard/events.jsonl` where dashboard/events.jsonl is
// gitignored (.gitignore): under `bash -e` the ignored-path `git add` errored and
// aborted the commit before any mirror repair was pushed. These tests pin the fix so
// a gitignored path can never re-enter the commit pathspec, and assert the on-failure
// alert (AC3) stays wired.
'use strict';

const { test, expect } = require('@playwright/test');
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const REPO_ROOT = path.resolve(__dirname, '..');
const WORKFLOW = path.join(REPO_ROOT, '.github', 'workflows', 'wiki-reconcile-cron.yml');

/** Extract every pathspec passed to a `git add` invocation in the workflow YAML. */
function gitAddPathspecs(yaml) {
  const specs = [];
  for (const raw of yaml.split('\n')) {
    const line = raw.trim();
    const m = line.match(/^git add\s+(.+)$/);
    if (!m) continue;
    for (const tok of m[1].split(/\s+/)) {
      if (tok && !tok.startsWith('-')) specs.push(tok);
    }
  }
  return specs;
}

/** True when `git check-ignore` reports the path as ignored by .gitignore. */
function isGitIgnored(p) {
  try {
    execFileSync('git', ['check-ignore', '-q', '--', p], { cwd: REPO_ROOT });
    return true; // exit 0 == ignored
  } catch {
    return false; // non-zero == not ignored
  }
}

test('workflow exists and stages at least one path', () => {
  expect(fs.existsSync(WORKFLOW)).toBe(true);
  const specs = gitAddPathspecs(fs.readFileSync(WORKFLOW, 'utf8'));
  expect(specs.length).toBeGreaterThan(0);
});

test('git add pathspec excludes every gitignored path (regression guard for #3718)', () => {
  const specs = gitAddPathspecs(fs.readFileSync(WORKFLOW, 'utf8'));
  const ignored = specs.filter(isGitIgnored);
  expect(ignored).toEqual([]);
});

test('the specific gitignored culprit dashboard/events.jsonl is not staged', () => {
  const specs = gitAddPathspecs(fs.readFileSync(WORKFLOW, 'utf8'));
  expect(specs).not.toContain('dashboard/events.jsonl');
  // Guard the intent, not just the literal: assert dashboard/events.jsonl really is ignored.
  expect(isGitIgnored('dashboard/events.jsonl')).toBe(true);
});

test('no forced add (-f/--force) reintroduces a gitignored runtime log', () => {
  const yaml = fs.readFileSync(WORKFLOW, 'utf8');
  expect(yaml).not.toMatch(/git add\s+(?:[^\n]*\s)?(?:-f\b|--force\b)/);
});

test('on-failure alert step stays wired (AC3 — silent daily-cron failure surfaces)', () => {
  const yaml = fs.readFileSync(WORKFLOW, 'utf8');
  expect(yaml).toMatch(/if:\s*\$\{\{\s*failure\(\)\s*\}\}/);
  expect(yaml).toMatch(/gh issue (?:create|comment)/);
  // The alert needs issue-write scope to reach a durable surface.
  expect(yaml).toMatch(/^\s*issues:\s*write\s*$/m);
});
