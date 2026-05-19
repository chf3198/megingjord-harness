'use strict';

const assert = require('node:assert/strict');
const { spawnSync } = require('node:child_process');
const { test } = require('node:test');
const parity = require('../scripts/global/orchestrator-governance-parity');

test('parity audit reports structured findings without throwing', () => {
  const result = parity.run();
  assert.equal(Array.isArray(result.findings), true);
  assert.equal(typeof result.checkedAt, 'string');
  assert.equal(result.manifest, 'inventory/orchestrator-governance-parity.json');
});

test('parity audit detects Claude hook adapter coverage', () => {
  const ids = parity.run().findings.map(f => f.id);
  assert.equal(ids.includes('claude-hooks-missing'), false);
});

test('parity audit detects Codex canonical gate coverage gap', () => {
  const ids = parity.run().findings.map(f => f.id);
  assert.equal(ids.includes('codex-hook-script-gap'), false);
  assert.equal(ids.includes('codex-permission-gap'), false);
});

test('parity audit detects all-target deploy and sync semantics coverage', () => {
  const ids = parity.run().findings.map(f => f.id);
  assert.equal(ids.includes('all-target-missing'), false);
});

test('parity audit detects Claude command adapter gap', () => {
  const ids = parity.run().findings.map(f => f.id);
  assert.equal(ids.includes('claude-command-gap'), false);
});

test('hook command parser supports flat and grouped hook schemas', () => {
  const config = { hooks: { Stop: [{ hooks: [
    { command: 'python3 ~/.x/stop_reminder.py' },
  ] }] } };
  assert.deepEqual(parity.hookCommands(config).scripts, ['stop_reminder.py']);
});

test('strict mode exits cleanly when parity is complete', () => {
  const result = spawnSync(process.execPath, [
    'scripts/global/orchestrator-governance-parity.js',
    '--strict',
  ], { encoding: 'utf8' });
  assert.equal(result.status, 0);
  assert.match(result.stdout, /"ok": true/);
});

test('diff helper models strict failure requirements', () => {
  assert.deepEqual(parity.diff(['goal_lens.py'], []), ['goal_lens.py']);
});

test('run() includes wiki_docs_memory observations in result', () => {
  const result = parity.run();
  assert.ok(result.observations.wiki, 'wiki observation present');
  assert.equal(result.observations.wiki.surface, 'wiki_docs_memory');
});
