// Unit tests for scripts/global/cross-team-signer-substrate.js (#1334 AC1).
// Verifies team-level substrate match between CROSS_TEAM_CLAIM and CONSULTANT_EPIC_CLOSEOUT.
// Pure helper; tests supply synthetic comments + minimal registry fixture.
const { test, expect } = require('@playwright/test');
const path = require('path');
const X = require(path.resolve(__dirname, '..', 'scripts', 'global', 'cross-team-signer-substrate.js'));

const REGISTRY = {
  substrateTeamMap: {
    'github-copilot': 'copilot',
    'codex-cli': 'codex',
    'codex-vscode-ide': 'codex',
    'claude-code-cli': 'claude-code',
    'openclaw-gateway': 'openclaw',
  },
};

test('parseCrossTeamClaim extracts substrate, alias, expires from a CROSS_TEAM_CLAIM comment', () => {
  const body = 'CROSS_TEAM_CLAIM: substrate=codex-cli, alias=Quill Vale, expires=2026-05-16T05:50:00Z';
  expect(X.parseCrossTeamClaim(body, REGISTRY)).toEqual({
    substrate: 'codex-cli', alias: 'Quill Vale', expires: '2026-05-16T05:50:00Z', team: 'codex',
  });
});

test('parseCrossTeamClaim returns null on no-claim body, empty string, or null', () => {
  expect(X.parseCrossTeamClaim('plain prose with no claim line', REGISTRY)).toBeNull();
  expect(X.parseCrossTeamClaim('', REGISTRY)).toBeNull();
  expect(X.parseCrossTeamClaim(null, REGISTRY)).toBeNull();
});

test('parseCrossTeamClaim resolves team=null for an unknown substrate', () => {
  const body = 'CROSS_TEAM_CLAIM: substrate=mystery-cli, alias=X Y, expires=2026-05-16T00:00:00Z';
  expect(X.parseCrossTeamClaim(body, REGISTRY).team).toBeNull();
});

test('activeClaim returns the most recent unresolved CROSS_TEAM_CLAIM', () => {
  const comments = [
    { body: 'CROSS_TEAM_CLAIM: substrate=github-copilot, alias=Soren Vale, expires=2026-05-15T01:00:00Z' },
    { body: 'CROSS_TEAM_CLAIM: substrate=codex-cli, alias=Quill Vale, expires=2026-05-16T05:50:00Z' },
  ];
  expect(X.activeClaim(comments, REGISTRY).team).toBe('codex');
});

test('activeClaim returns null when the latest CLAIM is followed by a _YIELD marker', () => {
  const comments = [
    { body: 'CROSS_TEAM_CLAIM: substrate=codex-cli, alias=Quill Vale, expires=2026-05-16T05:50:00Z' },
    { body: 'CROSS_TEAM_CLAIM_YIELD: substrate=codex-cli, deferred-to=github-copilot' },
  ];
  expect(X.activeClaim(comments, REGISTRY)).toBeNull();
});

test('activeClaim returns null when comments empty or null', () => {
  expect(X.activeClaim([], REGISTRY)).toBeNull();
  expect(X.activeClaim(null, REGISTRY)).toBeNull();
});

test('extractCloseoutTeam parses team prefix from the Team&Model field', () => {
  const body = 'CONSULTANT_EPIC_CLOSEOUT\nSigned-by: Quill Vale\nTeam&Model: codex:gpt-5.4@codex-cli\nRole: consultant';
  expect(X.extractCloseoutTeam(body)).toBe('codex');
});

test('extractCloseoutTeam returns null when Team&Model field absent', () => {
  expect(X.extractCloseoutTeam('no team-model field anywhere')).toBeNull();
  expect(X.extractCloseoutTeam(null)).toBeNull();
});

test('findCloseoutBody returns the first comment body containing CONSULTANT_EPIC_CLOSEOUT', () => {
  const comments = [
    { body: 'unrelated comment' },
    { body: 'CONSULTANT_EPIC_CLOSEOUT\nSigned-by: Quill Vale' },
    { body: 'CONSULTANT_EPIC_CLOSEOUT\nSigned-by: someone else' },
  ];
  expect(X.findCloseoutBody(comments)).toContain('Quill Vale');
});

test('findCloseoutBody returns null when no closeout present', () => {
  expect(X.findCloseoutBody([{ body: 'no closeout here' }])).toBeNull();
  expect(X.findCloseoutBody([])).toBeNull();
});

test('enforceSubstrateMatch passes when closeout team matches active claim team', () => {
  const result = X.enforceSubstrateMatch({
    closeoutTeam: 'codex',
    activeClaim: { team: 'codex', substrate: 'codex-cli' },
    labels: [],
  });
  expect(result.ok).toBe(true);
  expect(result.violations).toEqual([]);
});

test('enforceSubstrateMatch fails when closeout team differs from active claim team', () => {
  const result = X.enforceSubstrateMatch({
    closeoutTeam: 'claude-code',
    activeClaim: { team: 'codex', substrate: 'codex-cli' },
    labels: [],
  });
  expect(result.ok).toBe(false);
  expect(result.violations[0].rule).toBe('cross-team-substrate-mismatch');
  expect(result.violations[0].detail).toContain('claude-code');
  expect(result.violations[0].detail).toContain('codex');
});

test('enforceSubstrateMatch skips when waiver label present', () => {
  const result = X.enforceSubstrateMatch({
    closeoutTeam: 'claude-code',
    activeClaim: { team: 'codex' },
    labels: ['signer-substrate:waived'],
  });
  expect(result.ok).toBe(true);
  expect(result.skipped).toBe('override-waived');
});

test('enforceSubstrateMatch skips when claim or closeout team is missing', () => {
  expect(X.enforceSubstrateMatch({ closeoutTeam: null, activeClaim: { team: 'codex' } }).skipped).toBe('incomplete-data');
  expect(X.enforceSubstrateMatch({ closeoutTeam: 'codex', activeClaim: null }).skipped).toBe('incomplete-data');
});

test('end-to-end: parse claim, extract closeout team, enforce match', () => {
  const comments = [
    { body: 'CROSS_TEAM_CLAIM: substrate=codex-cli, alias=Quill Vale, expires=2026-05-16T05:50:00Z' },
    { body: 'CONSULTANT_EPIC_CLOSEOUT\nSigned-by: Quill Vale\nTeam&Model: codex:gpt-5.4@codex-cli\nRole: consultant' },
  ];
  const claim = X.activeClaim(comments, REGISTRY);
  const closeoutTeam = X.extractCloseoutTeam(X.findCloseoutBody(comments));
  const result = X.enforceSubstrateMatch({ closeoutTeam, activeClaim: claim, labels: [] });
  expect(result.ok).toBe(true);
});

test('end-to-end mismatch: codex claims, claude-code attempts to sign', () => {
  const comments = [
    { body: 'CROSS_TEAM_CLAIM: substrate=codex-cli, alias=Quill Vale, expires=2026-05-16T05:50:00Z' },
    { body: 'CONSULTANT_EPIC_CLOSEOUT\nSigned-by: Orla Vale\nTeam&Model: claude-code:opus-4-7@anthropic\nRole: consultant' },
  ];
  const claim = X.activeClaim(comments, REGISTRY);
  const closeoutTeam = X.extractCloseoutTeam(X.findCloseoutBody(comments));
  const result = X.enforceSubstrateMatch({ closeoutTeam, activeClaim: claim, labels: [] });
  expect(result.ok).toBe(false);
});
