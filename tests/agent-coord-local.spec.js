// Tests for Layer 4 local SQLite WAL coordination primitive (#739)
const { test, expect } = require('@playwright/test');
const os = require('os');
const path = require('path');
const fs = require('fs');

let coord;
let originalCwd;

test.beforeEach(() => {
  originalCwd = process.cwd();
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'coord-test-'));
  process.chdir(tmpDir);
  delete require.cache[require.resolve('../scripts/global/agent-coord-local')];
  coord = require('../scripts/global/agent-coord-local');
});

test.afterEach(() => {
  if (coord && coord._close) coord._close();
  process.chdir(originalCwd);
});

test('acquire lease blocks second caller while held', () => {
  const first = coord.acquireLease('build-slot', 60, 'agent-a');
  expect(first).not.toBeNull();
  expect(first.key).toBe('build-slot');
  const second = coord.acquireLease('build-slot', 60, 'agent-b');
  expect(second).toBeNull();
});

test('lease auto-expires after TTL', async () => {
  const first = coord.acquireLease('build-slot', 1, 'agent-a');
  expect(first).not.toBeNull();
  await new Promise(r => setTimeout(r, 1100));
  const second = coord.acquireLease('build-slot', 60, 'agent-b');
  expect(second).not.toBeNull();
  expect(second.agentId).toBe('agent-b');
});

test('release lease allows re-acquisition', () => {
  const first = coord.acquireLease('build-slot', 60, 'agent-a');
  expect(coord.releaseLease(first)).toBe(true);
  const second = coord.acquireLease('build-slot', 60, 'agent-b');
  expect(second).not.toBeNull();
});

test('heartbeat then listActiveAgents returns the agent', () => {
  coord.heartbeat('agent-a');
  const active = coord.listActiveAgents(300);
  expect(active.some(a => a.agent_id === 'agent-a')).toBe(true);
});

test('listActiveAgents excludes stale heartbeats', async () => {
  coord.heartbeat('agent-old');
  await new Promise(r => setTimeout(r, 1100));
  coord.heartbeat('agent-new');
  const recent = coord.listActiveAgents(1);
  const ids = recent.map(a => a.agent_id);
  expect(ids).toContain('agent-new');
  expect(ids).not.toContain('agent-old');
});
