'use strict';
// wiki-isolation-a4.spec.js — regression anchor for A4 namespace-isolation rule.
// Per instructions/wiki-knowledge.instructions.md: wiki/wisdom/project/ MUST NOT
// be distributed cross-project. deploy.sh must exclude it on every wiki-shipping
// command. Ticket #3455.

const assert = require('node:assert/strict');
const { test } = require('node:test');
const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');

const REPO_ROOT = path.resolve(__dirname, '..');
const DEPLOY_SH = path.join(REPO_ROOT, 'scripts', 'deploy.sh');

function deployShSource() {
  return fs.readFileSync(DEPLOY_SH, 'utf8');
}

// Detect every line in deploy.sh that ships the wiki subtree.
// A line ships the wiki when it references the wiki source path and a destination.
function wikiShippingLines(source) {
  return source.split('\n').filter((line) => {
    const trimmed = line.trim();
    if (trimmed.startsWith('#')) return false;
    return (
      trimmed.includes('wiki') &&
      (trimmed.includes('rsync') || trimmed.includes('cp ') || trimmed.includes('deploy_dir'))
    );
  });
}

test('deploy.sh contains wisdom/project exclusion on wiki rsync command', () => {
  const source = deployShSource();
  // The A4 exclusion must be present as an rsync --exclude flag covering wisdom/project.
  const hasExclusion = source.includes("--exclude='wisdom/project'") ||
    source.includes('--exclude=wisdom/project');
  assert.ok(
    hasExclusion,
    'deploy.sh must exclude wisdom/project from wiki deploy (A4 isolation rule, #3455)',
  );
});

test('deploy.sh does not use deploy_dir for wiki (cp-based helper cannot exclude)', () => {
  const source = deployShSource();
  const deployDirWikiLines = source.split('\n').filter((line) => {
    const trimmed = line.trim();
    return !trimmed.startsWith('#') && trimmed.includes('deploy_dir') && trimmed.includes('wiki');
  });
  assert.equal(
    deployDirWikiLines.length,
    0,
    `deploy.sh must not use deploy_dir for wiki — it cannot exclude subdirs. ` +
    `Found: ${deployDirWikiLines.join('; ')}`,
  );
});

test('every wiki-shipping line in deploy.sh carries the wisdom/project exclusion', () => {
  const source = deployShSource();
  const shippingLines = wikiShippingLines(source);
  // Only rsync-based lines need the exclusion flag; cp/deploy_dir lines should not exist (see test above).
  const rsyncWikiLines = shippingLines.filter((line) => line.includes('rsync') && line.includes('wiki'));
  for (const line of rsyncWikiLines) {
    const hasExclusion = line.includes('wisdom/project');
    assert.ok(
      hasExclusion,
      `Wiki rsync line missing wisdom/project exclusion (A4 rule): ${line.trim()}`,
    );
  }
});

test('dry-run simulation: deploy.sh dry-run output does not list wisdom/project as a deploy target', () => {
  // Run deploy.sh in dry-run mode (no --apply) and assert wisdom/project is not
  // listed as a "Would deploy" or "Would update" or "Would create" target.
  // The exclusion comment itself may mention wisdom/project — that is expected and fine.
  let output;
  try {
    output = execFileSync('bash', [DEPLOY_SH], {
      encoding: 'utf8',
      env: { ...process.env, HOME: process.env.HOME || '/tmp' },
    });
  } catch (err) {
    // deploy.sh exits 0 in dry-run; any non-zero exit is a real failure.
    assert.fail(`deploy.sh dry-run exited with error: ${err.message}`);
  }
  // Check that no line says "Would deploy: wisdom/project" or similar deploy-target lines.
  const deployTargetLines = output.split('\n').filter((line) => {
    const lower = line.toLowerCase();
    return (
      lower.includes('wisdom/project') &&
      (lower.includes('would deploy') || lower.includes('would update') || lower.includes('would create'))
    );
  });
  assert.equal(
    deployTargetLines.length,
    0,
    `deploy.sh dry-run must not list wisdom/project as a deploy target. Found: ${deployTargetLines.join('; ')}`,
  );
});
