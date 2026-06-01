'use strict';
// tests/collaborator-preflight.spec.js — Refs #2438

const { test, describe } = require('node:test');
const assert = require('node:assert');
const path = require('path');
const { run } = require(path.join(__dirname, '..', 'scripts', 'global',
  'collaborator-preflight.js'));

const mockReview = async () => ({ reviewer: 'qwen2.5:7b@fleet', rating: 82, findings: 'ok' });
const lintPass = () => ({ ok: true });
const testsPass = () => ({ ok: true });
const changelogPass = () => ({ ok: true });
const lintFail = () => ({ ok: false });
const testsFail = () => ({ ok: false });
const changelogFail = () => ({ ok: false, path: '.changes/unreleased/99.md' });

const baseArgs = ['--ticket=42'];
const baseOpts = {
  runLint: lintPass,
  runTests: testsPass,
  checkChangelog: changelogPass,
  runFleetReview: mockReview,
};

describe('collaborator-preflight (#2438)', () => {
  test('all gates pass returns true', async () => {
    const ok = await run(baseArgs, baseOpts);
    assert.strictEqual(ok, true);
  });

  test('lint gate failure returns false', async () => {
    const ok = await run(baseArgs, { ...baseOpts, runLint: lintFail });
    assert.strictEqual(ok, false);
  });

  test('tests gate failure returns false', async () => {
    const ok = await run(baseArgs, { ...baseOpts, runTests: testsFail });
    assert.strictEqual(ok, false);
  });

  test('missing changelog fragment returns false', async () => {
    const ok = await run(baseArgs, { ...baseOpts, checkChangelog: changelogFail });
    assert.strictEqual(ok, false);
  });

  test('missing --ticket arg returns false', async () => {
    const ok = await run([], baseOpts);
    assert.strictEqual(ok, false);
  });
});
