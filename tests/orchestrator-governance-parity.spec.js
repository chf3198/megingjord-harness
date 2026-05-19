'use strict';

const assert = require('node:assert/strict');
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
  assert.ok(ids.includes('codex-hook-script-gap'));
  assert.ok(ids.includes('codex-permission-gap'));
});

test('parity audit detects all-target deploy and sync semantics gap', () => {
  const ids = parity.run().findings.map(f => f.id);
  assert.ok(ids.includes('all-target-missing'));
});

test('parity audit detects Claude command adapter gap', () => {
  const result = parity.run();
  const gap = result.findings.find(f => f.id === 'claude-command-gap');
  assert.ok(gap);
  assert.match(gap.evidence, /missing \d+:/);
});

test('hook command parser supports flat and grouped hook schemas', () => {
  const config = { hooks: { Stop: [{ hooks: [
    { command: 'python3 ~/.x/stop_reminder.py' },
  ] }] } };
  assert.deepEqual(parity.hookCommands(config).scripts, ['stop_reminder.py']);
});
