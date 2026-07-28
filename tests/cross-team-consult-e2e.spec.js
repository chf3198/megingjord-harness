// Synthetic end-to-end verification for cross-team consult protocol (#1591 AC4 of #1334).
const { test, expect } = require('@playwright/test');
const path = require('path');
const E2E = require(path.resolve(__dirname, '..', 'scripts', 'global', 'cross-team-consult-e2e.js'));

const REGISTRY = {
  substrateTeamMap: { 'github-copilot': 'copilot', 'codex-cli': 'codex', 'claude-code-cli': 'claude-code' },
};
const CLAIM = { substrate: 'codex-cli', alias: 'Quill Vale', expires: '2026-05-16T00:00:00Z' };
const REAPER_NOW = Date.UTC(2026, 4, 17, 0, 0, 0);

test('step: Manager request auto-applies consultant:cross-team-needed', () => {
  const result = E2E.applyManagerRequest(E2E.initialState());
  expect(result.ok).toBe(true);
  expect(result.state.labels).toContain('consultant:cross-team-needed');
});

test('step: claim swaps label to :in-progress and posts CROSS_TEAM_CLAIM', () => {
  const state = E2E.applyManagerRequest(E2E.initialState()).state;
  const result = E2E.applyClaim(state, CLAIM);
  expect(result.ok).toBe(true);
  expect(result.state.labels).toContain('consultant:cross-team-in-progress');
  expect(result.state.labels).not.toContain('consultant:cross-team-needed');
});

test('step: reaper expires stale claim and reverts label to :needed', () => {
  let state = E2E.applyManagerRequest(E2E.initialState()).state;
  state = E2E.applyClaim(state, CLAIM).state;
  const result = E2E.applyReaper(state, REGISTRY, REAPER_NOW);
  expect(result.ok).toBe(true);
  expect(result.state.labels).toContain('consultant:cross-team-needed');
  expect(result.state.comments.at(-1).body).toContain('CROSS_TEAM_CLAIM_EXPIRED');
});

test('canReclaim: true after EXPIRED marker clears active claim', () => {
  let state = E2E.applyManagerRequest(E2E.initialState()).state;
  state = E2E.applyClaim(state, CLAIM).state;
  state = E2E.applyReaper(state, REGISTRY, REAPER_NOW).state;
  expect(E2E.canReclaim(state, REGISTRY)).toBe(true);
});

test('signer gate: matching team passes, mismatched team fails', () => {
  let state = E2E.applyManagerRequest(E2E.initialState()).state;
  state = E2E.applyClaim(state, { ...CLAIM, expires: '2026-05-20T00:00:00Z' }).state;
  const match = E2E.verifyCloseout(state, 'CONSULTANT_EPIC_CLOSEOUT\nTeam&Model: codex:gpt-5@codex-cli\nRole: consultant', REGISTRY);
  const mismatch = E2E.verifyCloseout(state, 'CONSULTANT_EPIC_CLOSEOUT\nTeam&Model: claude-code:opus@anthropic\nRole: consultant', REGISTRY);
  expect(match.ok).toBe(true);
  expect(mismatch.ok).toBe(false);
});

test('AC4 full synthetic flow: manager → claim → expire → reclaim → signer gate', () => {
  const flow = E2E.runSyntheticFlow(REGISTRY, { claimExpires: CLAIM.expires, reaperNowMs: REAPER_NOW });
  expect(flow.ok).toBe(true);
  expect(flow.signerGate.match.ok).toBe(true);
  expect(flow.signerGate.mismatch.ok).toBe(false);
  expect(flow.trace.map(t => t.step)).toEqual(['manager-auto-apply', 'claim', 'reaper-expire', 'claim']);
});
