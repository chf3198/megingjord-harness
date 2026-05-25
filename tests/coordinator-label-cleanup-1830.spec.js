// #1830 — coordinator-label-cleanup orphan-detection coverage.
// Covers AC3: orphan detection + resolution detection + idempotency.
const { test, expect } = require('@playwright/test');
const path = require('path');
const C = require(path.resolve(__dirname, '..', 'scripts', 'global', 'coordinator-label-cleanup.js'));

const COORD = C.COORDINATOR_LABEL;

const epicBody = (n) => `## Scope\n- Epic: #${n}\n\nstuff\n`;
const issue = (n, opts = {}) => ({
  number: n,
  title: opts.title || `Issue ${n}`,
  body: opts.body || '',
  labels: (opts.labels || []).map(name => ({ name })),
  user: { login: opts.user || 'alice' },
});

test('#1830 AC3: candidate without coordinator label is NOT orphan', () => {
  const c = issue(1, { labels: ['role:collaborator'] });
  expect(C.evaluateOrphan(c, [c], []).orphan).toBe(false);
});

test('#1830 AC3: candidate with coordinator + active sibling-role conflict is NOT orphan', () => {
  const c = issue(1, { labels: ['role:collaborator', 'team:claude-code', COORD], body: epicBody(100), user: 'alice' });
  const sibling = issue(2, { labels: ['role:collaborator', 'team:codex'], body: epicBody(100), user: 'bob' });
  expect(C.evaluateOrphan(c, [c, sibling], []).orphan).toBe(false);
});

test('#1830 AC3: candidate with coordinator + sibling-role conflict RESOLVED is orphan', () => {
  // sibling moved past role:collaborator to role:admin
  const c = issue(1, { labels: ['role:collaborator', 'team:claude-code', COORD], body: epicBody(100), user: 'alice' });
  const sibling = issue(2, { labels: ['role:admin', 'team:codex'], body: epicBody(100), user: 'bob' });
  const r = C.evaluateOrphan(c, [c, sibling], []);
  expect(r.orphan).toBe(true);
  expect(r.reason).toBe('no-active-conflict-or-parallel-pr');
});

test('#1830 AC3: candidate with coordinator + sibling CLOSED is orphan', () => {
  const c = issue(1, { labels: ['role:collaborator', 'team:claude-code', COORD], body: epicBody(100), user: 'alice' });
  // No sibling at all in the open-issue list = sibling closed
  expect(C.evaluateOrphan(c, [c], []).orphan).toBe(true);
});

test('#1830 AC3: candidate with coordinator + active parallel PR reference is NOT orphan', () => {
  const c = issue(5, { labels: [COORD] });
  const parallelPR = { number: 100, body: 'Refs #5\nCloses #5' };
  expect(C.evaluateOrphan(c, [c], [parallelPR]).orphan).toBe(false);
});

test('#1830 AC3: candidate with coordinator + parallel PRs all merged is orphan', () => {
  const c = issue(5, { labels: [COORD] });
  // No open PRs reference #5 (all merged/closed)
  expect(C.evaluateOrphan(c, [c], []).orphan).toBe(true);
});

test('#1830 AC3: candidate without role labels + no parallel PR is orphan (sibling-role check skipped gracefully)', () => {
  const c = issue(5, { labels: [COORD], body: epicBody(100) });
  expect(C.evaluateOrphan(c, [c], []).orphan).toBe(true);
});

test('#1830 AC3 findOrphans: returns only true orphans, ignores non-coordinator-labeled', () => {
  const orphan = issue(1, { labels: [COORD, 'role:collaborator', 'team:claude-code'], body: epicBody(100) });
  const sibling = issue(2, { labels: ['role:admin', 'team:codex'], body: epicBody(100) });
  const noCoordLabel = issue(3, { labels: ['role:collaborator'] });
  const result = C.findOrphans([orphan, sibling, noCoordLabel], []);
  expect(result.length).toBe(1);
  expect(result[0].issue.number).toBe(1);
});

test('#1830 AC3 idempotency: findOrphans on a corpus where orphans were already cleaned = empty', () => {
  // simulate post-cleanup state
  const orphan = issue(1, { labels: ['role:collaborator', 'team:claude-code'], body: epicBody(100) });  // no COORD
  const sibling = issue(2, { labels: ['role:admin', 'team:codex'], body: epicBody(100) });
  expect(C.findOrphans([orphan, sibling], []).length).toBe(0);
});

test('#1830: team detection falls back to user.login when no team:* label', () => {
  const c = issue(1, { labels: ['role:collaborator', COORD], body: epicBody(100), user: 'alice' });
  const sib = issue(2, { labels: ['role:collaborator'], body: epicBody(100), user: 'bob' });
  // Different users (alice vs bob) → conflict still detected via user-fallback
  expect(C.evaluateOrphan(c, [c, sib], []).orphan).toBe(false);
});
