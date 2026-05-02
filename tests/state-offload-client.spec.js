// Tests for #785 state-offload client
const { test, expect } = require('@playwright/test');
const fs = require('fs');
const path = require('path');
const os = require('os');

const CLIENT = '../scripts/global/state-offload-client';

let originalCwd;
let tmpDir;

test.beforeEach(() => {
  originalCwd = process.cwd();
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'state-test-'));
  fs.mkdirSync(path.join(tmpDir, '.dashboard'), { recursive: true });
  process.chdir(tmpDir);
  delete require.cache[require.resolve(CLIENT)];
  delete process.env.CLOUDFLARE_WORKER_URL;
});

test.afterEach(() => {
  process.chdir(originalCwd);
});

test('no manifest → _workerUrl returns null', () => {
  const c = require(CLIENT);
  expect(c._workerUrl()).toBeNull();
});

test('manifest with cloudflare.worker unavailable → _workerUrl returns null', () => {
  fs.writeFileSync(path.join(tmpDir, '.dashboard', 'capabilities.json'), JSON.stringify({
    cloudflare: { worker: { available: false } },
  }));
  const c = require(CLIENT);
  expect(c._workerUrl()).toBeNull();
});

test('manifest available + env var → _workerUrl returns the URL', () => {
  fs.writeFileSync(path.join(tmpDir, '.dashboard', 'capabilities.json'), JSON.stringify({
    cloudflare: { worker: { available: true } },
  }));
  process.env.CLOUDFLARE_WORKER_URL = 'https://example.workers.dev';
  const c = require(CLIENT);
  expect(c._workerUrl()).toBe('https://example.workers.dev');
});

test('getRecentActivity reads .dashboard/events.jsonl on cache miss', async () => {
  const eventsFile = path.join(tmpDir, '.dashboard', 'events.jsonl');
  const since = '2026-05-01T00:00:00Z';
  fs.writeFileSync(eventsFile, [
    JSON.stringify({ ts: '2026-04-30T00:00:00Z', type: 'old' }),
    JSON.stringify({ ts: '2026-05-01T12:00:00Z', type: 'new' }),
  ].join('\n'));
  const c = require(CLIENT);
  const result = await c.getRecentActivity(since);
  expect(result.source).toBe('local');
  expect(result.stale).toBe(false);
  expect(result.value.length).toBe(1);
  expect(result.value[0].type).toBe('new');
});

test('getBranchPointer falls back to git when no Worker', async () => {
  const { execSync } = require('child_process');
  execSync('git init -q', { cwd: tmpDir });
  execSync('git config user.email t@t', { cwd: tmpDir });
  execSync('git config user.name t', { cwd: tmpDir });
  fs.writeFileSync(path.join(tmpDir, 'a.txt'), 'a');
  execSync('git add . && git commit -q -m init', { cwd: tmpDir });
  const c = require(CLIENT);
  const result = await c.getBranchPointer(tmpDir);
  expect(result.source).toBe('github');
  expect(result.value).toHaveProperty('branch');
  expect(result.value).toHaveProperty('sha');
  expect(result.value.sha.length).toBe(40);
});
