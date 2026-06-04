'use strict';
const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { registerSession, activeSessions, attributeForeignWriter } = require('../scripts/global/runtime-session-registry');

const NOW = Date.parse('2026-06-05T00:00:00Z');
const aliveAll = () => true;
function tmpdir() { return fs.mkdtempSync(path.join(os.tmpdir(), 'rsr-')); }

test('registerSession: writes one per-session file; re-register overwrites (no dup)', () => {
  const dir = tmpdir();
  registerSession('copilot', { dir, sessionId: 's1', pid: 111, now: NOW });
  registerSession('copilot', { dir, sessionId: 's1', pid: 111, now: NOW });
  assert.strictEqual(fs.readdirSync(dir).filter((f) => f.endsWith('.json')).length, 1);
  fs.rmSync(dir, { recursive: true, force: true });
});
test('concurrency: two runtimes registering different sessions never lose entries', () => {
  const dir = tmpdir();
  registerSession('claude-code', { dir, sessionId: 'A', pid: 1, now: NOW });
  registerSession('copilot', { dir, sessionId: 'B', pid: 2, now: NOW }); // "concurrent" — own file
  const act = activeSessions({ dir, at: '2026-06-05T00:00:00Z', pidAlive: aliveAll });
  assert.deepStrictEqual(act.map((s) => s.runtime).sort(), ['claude-code', 'copilot']);
  fs.rmSync(dir, { recursive: true, force: true });
});
test('activeSessions: prunes expired and dead-pid files from disk', () => {
  const dir = tmpdir();
  registerSession('copilot', { dir, sessionId: 'live', pid: 1, now: NOW });
  registerSession('codex', { dir, sessionId: 'expired', pid: 1, now: NOW - 13 * 3600 * 1000 });
  registerSession('antigravity', { dir, sessionId: 'dead', pid: 2, now: NOW });
  const act = activeSessions({ dir, at: '2026-06-05T00:00:00Z', pidAlive: (pid) => pid === 1 });
  assert.deepStrictEqual(act.map((s) => s.runtime), ['copilot']);
  // expired + dead files pruned from disk:
  assert.strictEqual(fs.readdirSync(dir).filter((f) => f.endsWith('.json')).length, 1);
  fs.rmSync(dir, { recursive: true, force: true });
});
test('attributeForeignWriter: names the single foreign runtime', () => {
  const dir = tmpdir();
  registerSession('claude-code', { dir, sessionId: 'A', pid: 1, now: NOW });
  registerSession('copilot', { dir, sessionId: 'B', pid: 1, now: NOW });
  assert.strictEqual(attributeForeignWriter('claude-code', { dir, at: '2026-06-05T00:00:00Z', pidAlive: aliveAll }), 'copilot');
  fs.rmSync(dir, { recursive: true, force: true });
});
test('attributeForeignWriter: undetermined when no foreign active session', () => {
  const dir = tmpdir();
  registerSession('claude-code', { dir, sessionId: 'A', pid: 1, now: NOW });
  assert.strictEqual(attributeForeignWriter('claude-code', { dir, at: '2026-06-05T00:00:00Z', pidAlive: aliveAll }), 'undetermined');
  fs.rmSync(dir, { recursive: true, force: true });
});
test('attributeForeignWriter: multiple:<list> when >1 foreign runtime', () => {
  const dir = tmpdir();
  registerSession('copilot', { dir, sessionId: 'B', pid: 1, now: NOW });
  registerSession('codex', { dir, sessionId: 'C', pid: 1, now: NOW });
  const r = attributeForeignWriter('claude-code', { dir, at: '2026-06-05T00:00:00Z', pidAlive: aliveAll });
  assert.match(r, /^multiple:/);
  assert.ok(r.includes('copilot') && r.includes('codex'));
  fs.rmSync(dir, { recursive: true, force: true });
});
