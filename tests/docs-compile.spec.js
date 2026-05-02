// Tests for #796 README compile pipeline
const { test, expect } = require('@playwright/test');
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const REPO = path.resolve(__dirname, '..');
const README = path.join(REPO, 'README.md');
const COMPILE = path.join(REPO, 'scripts', 'docs-compile.js');
const TRANSFORMS = path.join(REPO, 'scripts', 'global', 'docs-transforms.js');

test('packageScripts transform produces a markdown table from package.json', () => {
  delete require.cache[require.resolve(TRANSFORMS)];
  const { packageScripts } = require(TRANSFORMS);
  const out = packageScripts();
  expect(out).toContain('| Script | Command |');
  expect(out).toContain('|---|---|');
  expect(out).toContain('docs:compile');
});

test('packageScripts escapes pipe characters in commands', () => {
  delete require.cache[require.resolve(TRANSFORMS)];
  const { packageScripts } = require(TRANSFORMS);
  const pkgPath = path.join(REPO, 'package.json');
  const original = fs.readFileSync(pkgPath, 'utf-8');
  const tampered = original.replace('"docs:compile":', '"_pipe_test": "echo a | grep b",\n    "docs:compile":');
  fs.writeFileSync(pkgPath, tampered);
  try {
    const out = packageScripts();
    expect(out).toContain('\\|');
  } finally {
    fs.writeFileSync(pkgPath, original);
  }
});

test('docs:compile is idempotent — second run produces no diff', () => {
  execSync(`node ${COMPILE}`, { cwd: REPO });
  const first = fs.readFileSync(README, 'utf-8');
  execSync(`node ${COMPILE}`, { cwd: REPO });
  const second = fs.readFileSync(README, 'utf-8');
  expect(second).toBe(first);
});

test('docs:compile --check passes on a freshly compiled README', () => {
  execSync(`node ${COMPILE}`, { cwd: REPO });
  const result = execSync(`node ${COMPILE} --check`, { cwd: REPO }).toString();
  expect(result).toContain('in sync');
});

test('docs:compile --check fails when fence content has been hand-edited', () => {
  const original = fs.readFileSync(README, 'utf-8');
  try {
    const tampered = original.replace(/<!-- docs packageScripts -->[\s\S]*?<!-- \/docs -->/,
      '<!-- docs packageScripts -->\nhand-edited table\n<!-- /docs -->');
    fs.writeFileSync(README, tampered);
    let failed = false;
    try {
      execSync(`node ${COMPILE} --check`, { cwd: REPO, stdio: 'pipe' });
    } catch {
      failed = true;
    }
    expect(failed).toBe(true);
  } finally {
    fs.writeFileSync(README, original);
  }
});

test('README contains the auto-generated fence', () => {
  const content = fs.readFileSync(README, 'utf-8');
  expect(content).toContain('<!-- docs packageScripts -->');
  expect(content).toContain('<!-- /docs -->');
});
