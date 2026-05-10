'use strict';
const { test, expect } = require('@playwright/test');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const codify = require(path.join(root, 'scripts/global/cross-team-review-codify.js'));
const backfill = require(path.join(root, 'scripts/global/epic-backfill-audit.js'));

test.describe('C10 #1296 — cross-team review codify', () => {
  test('detects cross-team comments', () => {
    const result = codify.detectCrossTeamComments({
      issueBody: 'Signed-by: Cole Mason\nTeam&Model: claude-code:opus-4-7@anthropic\n',
      comments: [
        { id: 1, body: 'Team&Model: codex:gpt-5@codex-cli', created_at: new Date().toISOString(), html_url: 'u1' },
        { id: 2, body: 'Team&Model: copilot:gpt-5.3-codex@local', created_at: new Date().toISOString(), html_url: 'u2' },
        { id: 3, body: 'Team&Model: claude-code:opus-4-7@anthropic', created_at: new Date().toISOString(), html_url: 'u3' },
      ],
    });
    expect(result.ownerTeam).toBe('claude-code');
    expect(result.count).toBe(2);
  });
  test('threshold + window constants codified', () => {
    expect(codify.THRESHOLD).toBe(2);
    expect(codify.WINDOW_DAYS).toBe(14);
  });
  test('teamPart parses Team&Model substring', () => {
    expect(codify.teamPart('claude-code:opus-4-7@anthropic')).toBe('claude-code');
    expect(codify.teamPart(null)).toBe(null);
  });
});

test.describe('C8 #1295 — backfill audit disposition', () => {
  test('no-action when all ready', () => {
    const dispo = backfill.disposition([{ truth_status: 'READY_TO_CLOSE' }]);
    expect(dispo.kind).toBe('no-action');
  });
  test('rescope-proposal for measurement-window ACs (#1130 pattern)', () => {
    const dispo = backfill.disposition([
      { ac_id: 'AC4', truth_status: 'UNMET' },
      { ac_id: 'AC5', truth_status: 'UNMET' },
    ]);
    expect(dispo.kind).toBe('rescope-proposal');
  });
  test('measuring-window when only MEASURING ACs', () => {
    const dispo = backfill.disposition([{ ac_id: 'AC4', truth_status: 'MEASURING' }]);
    expect(dispo.kind).toBe('measuring-window');
  });
  test('builds advisory comment with truth-status table', () => {
    const reconciled = [{ ac_id: 'AC4', checked: false, truth_status: 'UNMET' }];
    const dispo = { kind: 'rescope-proposal', reason: 'test', acs: ['AC4'] };
    const out = backfill.buildAdvisoryComment(1130, reconciled, dispo);
    expect(out).toContain('Epic #1130');
    expect(out).toContain('rescope-proposal');
    expect(out).toContain('| AC4 | false | UNMET |');
  });
  test('TARGET_EPICS includes the canonical legacy set', () => {
    expect(backfill.TARGET_EPICS).toEqual([1130, 1103, 1113, 1211]);
  });
});
