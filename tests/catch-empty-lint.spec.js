'use strict';

const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const { test, expect } = require('@playwright/test');

const REPO_ROOT = path.resolve(__dirname, '..');
const SCRIPT = path.join(REPO_ROOT, 'scripts/global/catch-empty-lint.sh');

function tempDir(prefix) {
  return fs.mkdtempSync(path.join(os.tmpdir(), prefix));
}

function writeWorkflow(root, relPath, body) {
  const filePath = path.join(root, relPath);
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, body);
  return filePath;
}

function runLint(root) {
  return spawnSync('bash', [SCRIPT, root], {
    cwd: REPO_ROOT,
    encoding: 'utf8',
  });
}

test('catch-empty lint flags empty catches and counts suppressions', () => {
  const root = tempDir('catch-empty-good-');
  writeWorkflow(root, '.github/workflows/good.yml', `name: good
on: [push]
jobs:
  ok:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/github-script@v7
        with:
          script: |
            await github.rest.issues.removeLabel({ owner: 'x', repo: 'y', issue_number: 1, name: 'z' })
              .catch((err) => { if (err?.status !== 404) throw err; });
`);
  const r = runLint(root);
  expect(r.status).toBe(0);
  expect(r.stdout).toContain('OK: no unsuppressed empty catches found.');
});

test('catch-empty lint rejects bare empty catches', () => {
  const root = tempDir('catch-empty-bad-');
  writeWorkflow(root, '.github/workflows/bad.yml', `name: bad
on: [push]
jobs:
  bad:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/github-script@v7
        with:
          script: |
            await github.rest.issues.removeLabel({ owner: 'x', repo: 'y', issue_number: 1, name: 'z' })
              .catch(() => {})
`);
  const r = runLint(root);
  expect(r.status).toBe(1);
  expect(r.stdout + r.stderr).toContain('ERROR: unsuppressed empty catch block(s) found above.');
});

test('workflow call sites use status-specific catch handling and summary step exists', () => {
  const claimReaper = fs.readFileSync(path.join(REPO_ROOT, '.github/workflows/cross-team-claim-reaper.yml'), 'utf8');
  const editWarn = fs.readFileSync(path.join(REPO_ROOT, '.github/workflows/cross-team-edit-warn.yml'), 'utf8');
  const lintWorkflow = fs.readFileSync(path.join(REPO_ROOT, '.github/workflows/lint.yml'), 'utf8');

  expect(claimReaper).toContain('if (err?.status !== 404) throw err;');
  expect(claimReaper).toContain('if (err?.status !== 422) throw err;');
  expect(editWarn).toContain('if (err?.status !== 404) throw err;');
  expect(editWarn).toContain('if (err?.status !== 422) throw err;');
  expect(lintWorkflow).toContain('Catch-empty suppression summary');
  expect(lintWorkflow).toContain('GITHUB_STEP_SUMMARY');
});
