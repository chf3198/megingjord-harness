// Cross-team queue tests (#1305).
const { test, expect } = require('@playwright/test');
const path = require('path');
const Q = require(path.resolve(__dirname, '..', 'scripts', 'global', 'cross-team-queue.js'));

const registry = {
  teamModelSpec: { substrates: ['github-copilot', 'claude-code-cli', 'codex-cli', 'openclaw-gateway'] },
};

test('resolveCallerTeam maps github-copilot → copilot', () => {
  expect(Q.resolveCallerTeam('github-copilot', registry)).toBe('copilot');
});

test('resolveCallerTeam maps codex-cli → codex', () => {
  expect(Q.resolveCallerTeam('codex-cli', registry)).toBe('codex');
});

test('resolveCallerTeam maps claude-code-cli → claude-code', () => {
  expect(Q.resolveCallerTeam('claude-code-cli', registry)).toBe('claude-code');
});

test('resolveCallerTeam rejects unknown substrate', () => {
  expect(() => Q.resolveCallerTeam('unknown-substrate', registry)).toThrow(/Unknown substrate/);
});

test('activeClaim returns null when no claims present', () => {
  expect(Q.activeClaim([{ body: 'regular comment' }, { body: 'another' }])).toBeNull();
});

test('activeClaim returns the most recent claim if unresolved', () => {
  const comments = [
    { body: 'CROSS_TEAM_CLAIM: substrate=codex-cli, alias=Caden Vale, expires=2026-05-11T18:00:00Z', created_at: '2026-05-10T10:00:00Z' },
  ];
  const c = Q.activeClaim(comments);
  expect(c).not.toBeNull();
  expect(c.substrate).toBe('codex-cli');
  expect(c.alias).toBe('Caden Vale');
});

test('activeClaim returns null after CLAIM_YIELD resolves the queue', () => {
  const comments = [
    { body: 'CROSS_TEAM_CLAIM: substrate=codex-cli, alias=A, expires=2026', created_at: '2026-05-10T10:00:00Z' },
    { body: 'CROSS_TEAM_CLAIM_YIELD: substrate=codex-cli, deferred-to=github-copilot', created_at: '2026-05-10T10:05:00Z' },
  ];
  expect(Q.activeClaim(comments)).toBeNull();
});

test('activeClaim returns null after CLAIM_EXPIRED', () => {
  const comments = [
    { body: 'CROSS_TEAM_CLAIM: substrate=codex-cli, alias=A, expires=2026', created_at: '2026-05-10T10:00:00Z' },
    { body: 'CROSS_TEAM_CLAIM_EXPIRED: expired-at=2026-05-11T11:00:00Z', created_at: '2026-05-11T11:00:00Z' },
  ];
  expect(Q.activeClaim(comments)).toBeNull();
});

test('formatClaim contains substrate, alias, and expires', () => {
  const body = Q.formatClaim('codex-cli', 'Caden Vale');
  expect(body).toMatch(/CROSS_TEAM_CLAIM:/);
  expect(body).toMatch(/substrate=codex-cli/);
  expect(body).toMatch(/alias=Caden Vale/);
  expect(body).toMatch(/expires=20\d\d-\d\d-\d\dT/);
});

test('formatYield contains substrate and deferred-to', () => {
  expect(Q.formatYield('codex-cli', 'github-copilot')).toBe('CROSS_TEAM_CLAIM_YIELD: substrate=codex-cli, deferred-to=github-copilot');
});

test('CLAIM_RE captures expected fields', () => {
  const m = 'CROSS_TEAM_CLAIM: substrate=codex-cli, alias=Caden Vale, expires=2026-05-11T18:00:00Z'.match(Q.CLAIM_RE);
  expect(m).not.toBeNull();
  expect(m[1]).toBe('codex-cli');
  expect(m[2]).toBe('Caden Vale');
});

test('CLAIM_TTL_HOURS default is 24', () => {
  expect(Q.CLAIM_TTL_HOURS).toBe(24);
});
