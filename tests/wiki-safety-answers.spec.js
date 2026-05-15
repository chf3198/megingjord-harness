// Wiki write-safety + answer-tier tests (#871 + #1017).
const { test, expect } = require('@playwright/test');
const path = require('path');
const fs = require('fs');
const os = require('os');
const W = require(path.resolve(__dirname, '..', 'scripts', 'wiki', 'write-safety.js'));
const A = require(path.resolve(__dirname, '..', 'scripts', 'wiki', 'answer.js'));

const PROV = { author: 'test', team: 'claude-code', model: 'opus-4-7',
  agent_role: 'collaborator', commit: 'abc123' };
const TEAM_PROV = { ...PROV, thread_id: 'thread-1', append_position: 1 };

test('write-safety constants documented', () => {
  expect(W.LOCK_TTL_MS).toBe(5 * 60 * 1000);
  expect(W.PROVENANCE_FIELDS).toContain('author');
  expect(W.PROVENANCE_FIELDS).toContain('team');
  expect(W.TEAM_APPEND_FIELDS).toContain('thread_id');
});

test('validateProvenance rejects missing fields', () => {
  expect(W.validateProvenance({}).ok).toBe(false);
  expect(W.validateProvenance({}).missing.length).toBeGreaterThan(0);
});

test('validateProvenance accepts complete fields', () => {
  expect(W.validateProvenance(PROV).ok).toBe(true);
});

test('validateProvenance requires append fields in team-append mode', () => {
  expect(W.validateProvenance(PROV, { scope: 'team-append' }).ok).toBe(false);
  expect(W.validateProvenance(TEAM_PROV, { scope: 'team-append' }).ok).toBe(true);
});

test('lockKey is deterministic 16-char hash', () => {
  expect(W.lockKey('test-slug').length).toBe(16);
  expect(W.lockKey('test-slug')).toBe(W.lockKey('test-slug'));
});

test('lockKey scopes team-append locks by team', () => {
  expect(W.lockKey('test-slug', { team: 'claude-code' }, { scope: 'team-append' }))
    .not.toBe(W.lockKey('test-slug', { team: 'codex' }, { scope: 'team-append' }));
});

test('acquireLock + releaseLock work for unique slug', () => {
  const slug = `pw-test-${Date.now()}`;
  const acq = W.acquireLock(slug, PROV);
  expect(acq.ok).toBe(true);
  expect(fs.existsSync(acq.lockPath)).toBe(true);
  W.releaseLock(slug);
  expect(fs.existsSync(acq.lockPath)).toBe(false);
});

test('acquireLock blocks second-acquire within TTL', () => {
  const slug = `pw-block-${Date.now()}`;
  const first = W.acquireLock(slug, PROV);
  expect(first.ok).toBe(true);
  const second = W.acquireLock(slug, PROV);
  expect(second.ok).toBe(false);
  expect(second.reason).toBe('held');
  W.releaseLock(slug);
});

test('team-append writes can coexist in the same thread dir', () => {
  const threadDir = fs.mkdtempSync(path.join(os.tmpdir(), 'wiki-thread-'));
  const cases = [
    ['claude.md', { ...TEAM_PROV, team: 'claude-code' }],
    ['copilot.md', { ...TEAM_PROV, team: 'copilot-team' }],
    ['codex.md', { ...TEAM_PROV, team: 'codex-team' }],
  ];
  const results = cases.map(([file, provenance]) => W.acquireLock(path.join(threadDir, file), provenance,
    { scope: 'team-append' }));
  expect(results.every(result => result.ok)).toBe(true);
  cases.forEach(([file, provenance]) => W.releaseLock(path.join(threadDir, file), provenance, { scope: 'team-append' }));
  fs.rmSync(threadDir, { recursive: true, force: true });
});

test('stampProvenance prepends provenance comment', () => {
  const result = W.stampProvenance('# Hello', PROV);
  expect(result.ok).toBe(true);
  expect(result.stamped).toContain('provenance');
  expect(result.stamped).toContain('# Hello');
});

test('stampProvenance accepts team-append provenance fields', () => {
  const result = W.stampProvenance('# Thread note', TEAM_PROV, { scope: 'team-append' });
  expect(result.ok).toBe(true);
  expect(result.stamped).toContain('thread_id');
});

test('answer slugify produces clean slug', () => {
  expect(A.slugify('What is HAMR?')).toBe('what-is-hamr');
  expect(A.slugify('Two   spaces')).toBe('two-spaces');
});

test('answer SLUG_MAX caps slug length', () => {
  expect(A.SLUG_MAX).toBe(80);
});
