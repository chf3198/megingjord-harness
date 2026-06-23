// Unit tests for scripts/global/collaborator-self-check.{js,rules.js} (Epic #1568 AC-2, #1571).
// One pass + one fail fixture per deterministic check. Covers the runChecks dispatcher,
// the waiver-label skip, and null-safety on every input variant.
const { test, expect } = require('@playwright/test');
const path = require('path');
const C = require(path.resolve(__dirname, '..', 'scripts', 'global', 'collaborator-self-check.js'));
const R = require(path.resolve(__dirname, '..', 'scripts', 'global', 'collaborator-self-check-rules.js'));

test('branch-name-prefix: pass on fix/<N>-<slug>, fail on refactor/<N>-<slug>', () => {
  expect(R.branchNamePrefix('fix/1571-collab-check').ok).toBe(true);
  expect(R.branchNamePrefix('refactor/1571-collab-check').ok).toBe(false);
});

test('refs-this-ticket-first: pass when first Refs matches, fail when first Refs is a different ticket', () => {
  expect(R.refsThisTicketFirst('Closes #1571\nRefs #1571\nRefs Epic #1568', 1571).ok).toBe(true);
  expect(R.refsThisTicketFirst('Closes #1571\nRefs Epic #1568\nRefs #1569', 1571).ok).toBe(false);
  expect(R.refsThisTicketFirst('Closes #1571 only', 1571).ok).toBe(false);
});

test('closes-and-refs-both-present: pass only when both literal strings match the ticket', () => {
  expect(R.closesAndRefsBothPresent('Closes #1571\nRefs #1571', 1571).ok).toBe(true);
  expect(R.closesAndRefsBothPresent('Closes #1571', 1571).ok).toBe(false);
  expect(R.closesAndRefsBothPresent('Refs #1571', 1571).ok).toBe(false);
});

test('tdd-spec-in-diff-when-required: pass when tdd-pyramid + spec; fail when tdd-pyramid + no spec; skip otherwise', () => {
  expect(R.tddSpecInDiffWhenRequired('tdd-pyramid', ['tests/foo.spec.js']).ok).toBe(true);
  expect(R.tddSpecInDiffWhenRequired('tdd-pyramid', ['scripts/foo.js']).ok).toBe(false);
  expect(R.tddSpecInDiffWhenRequired('golden-file', []).ok).toBe(true);
  expect(R.tddSpecInDiffWhenRequired('tdd-trophy', ['tests/bar.spec.ts']).ok).toBe(true);
});

test('no-prose-colon-collision: fail when prose contains Team&Model: <text> outside signature, pass on clean body', () => {
  expect(R.noProseColonCollision('Team&Model: claude-code:opus-4-7@anthropic\nRole: collaborator').ok).toBe(true);
  expect(R.noProseColonCollision('explanation says Team&Model: line then end').ok).toBe(false);
  expect(R.noProseColonCollision('plain prose with no collision').ok).toBe(true);
});

test('no-markdown-bold-on-test-strategy: fail on **test_strategy** wrapping, pass on plain', () => {
  expect(R.noMarkdownBoldOnTestStrategy('test_strategy: tdd-pyramid').ok).toBe(true);
  expect(R.noMarkdownBoldOnTestStrategy('**test_strategy:** tdd-pyramid').ok).toBe(false);
});

test('flaw-marker-citations: pass when nearby #N citation present, fail when marker word is orphan', () => {
  const cited = 'Refs #1571\nreal flaw discovered in module X\nfixed in commit Y';
  const orphan = 'real flaw discovered, no citation anywhere\nstill no #N in the next two lines\nblah';
  expect(R.flawMarkerCitations(cited).ok).toBe(true);
  expect(R.flawMarkerCitations(orphan).ok).toBe(false);
});

test('readability-no-new-warnings: pass on equal-or-lower count, fail on increase, skip on missing data', () => {
  expect(R.readabilityNoNewWarnings({ baseline: 410, current: 408 }).ok).toBe(true);
  expect(R.readabilityNoNewWarnings({ baseline: 410, current: 410 }).ok).toBe(true);
  expect(R.readabilityNoNewWarnings({ baseline: 410, current: 415 }).ok).toBe(false);
  expect(R.readabilityNoNewWarnings(null).ok).toBe(true);
});

test('all-acceptance-criteria-ticked: pass when collab tick count >= manager declared, fail otherwise', () => {
  const mh = '- [ ] AC1: do X\n- [ ] AC2: do Y\n- [ ] AC3: do Z';
  const chOk = '- [x] AC1: done\n- [x] AC2: done\n- [x] AC3: done';
  const chShort = '- [x] AC1: done\n- [ ] AC2: not yet';
  expect(R.allAcceptanceCriteriaTicked(mh, chOk).ok).toBe(true);
  expect(R.allAcceptanceCriteriaTicked(mh, chShort).ok).toBe(false);
});

test('model-diversity-prospective-admin: pass on different team-model, fail on identical, skip when admin missing', () => {
  expect(R.modelDiversityProspectiveAdmin('claude-code:opus-4-7@anthropic', 'claude-code:sonnet-4-6@anthropic').ok).toBe(true);
  expect(R.modelDiversityProspectiveAdmin('claude-code:opus-4-7@anthropic', 'claude-code:opus-4-7@anthropic').ok).toBe(false);
  expect(R.modelDiversityProspectiveAdmin('claude-code:opus-4-7@anthropic', '').ok).toBe(true);
});

test('runChecks dispatcher returns aggregated ok=true when all 10 pass', () => {
  const result = C.runChecks({
    branchName: 'fix/1571-collab-check',
    prBody: 'Closes #1571\nRefs #1571',
    ticketNumber: 1571,
    testStrategy: 'tdd-pyramid',
    prFiles: ['tests/collaborator-self-check.spec.js'],
    handoffBody: 'test_strategy: tdd-pyramid\n- [x] AC1: done\n- [x] AC2: done\nTeam&Model: claude-code:opus-4-7@anthropic',
    readabilityWarnings: { baseline: 410, current: 408 },
    managerHandoffBody: '- [ ] AC1\n- [ ] AC2',
    ownTeamModel: 'claude-code:opus-4-7@anthropic',
    prospectiveAdminTeamModel: 'claude-code:sonnet-4-6@anthropic',
  });
  expect(result.ok).toBe(true);
  expect(result.checks).toHaveLength(10);
});

test('runChecks dispatcher returns aggregated ok=false when any check fails (and reports each failure)', () => {
  const result = C.runChecks({
    branchName: 'refactor/1571-bad-prefix',
    prBody: 'Closes #1571',
    ticketNumber: 1571,
    testStrategy: 'tdd-pyramid',
    prFiles: [],
    handoffBody: '**test_strategy:** tdd-pyramid',
    readabilityWarnings: { baseline: 410, current: 425 },
    managerHandoffBody: '- [ ] AC1\n- [ ] AC2\n- [ ] AC3',
    ownTeamModel: 'claude-code:opus-4-7@anthropic',
    prospectiveAdminTeamModel: 'claude-code:opus-4-7@anthropic',
  });
  expect(result.ok).toBe(false);
  const failedIds = result.checks.filter(c => !c.ok).map(c => c.id);
  expect(failedIds).toContain('branch-name-prefix');
  expect(failedIds).toContain('no-markdown-bold-on-test-strategy');
  expect(failedIds).toContain('readability-no-new-warnings');
  expect(failedIds).toContain('model-diversity-prospective-admin');
});

test('runChecks is skipped when the override label is present', () => {
  const result = C.runChecks({ labels: ['collaborator-self-check:waived'] });
  expect(result.ok).toBe(true);
  expect(result.skipped).toBe('override-waived');
  expect(result.checks).toEqual([]);
});

test('formatChecks renders a markdown-friendly check table', () => {
  const result = C.runChecks({
    branchName: 'fix/1571-x', prBody: 'Closes #1571\nRefs #1571', ticketNumber: 1571,
    testStrategy: 'golden-file', prFiles: [], handoffBody: 'clean body',
    managerHandoffBody: '', ownTeamModel: '', prospectiveAdminTeamModel: '',
  });
  const formatted = C.formatChecks(result);
  expect(formatted).toContain('Pre-handoff verification');
  expect(formatted).toContain('branch-name-prefix');
});

test('formatChecks renders the skip reason when override label is present', () => {
  expect(C.formatChecks({ ok: true, checks: [], skipped: 'override-waived' }))
    .toBe('Pre-handoff verification: SKIPPED (override-waived)');
});

test('mcpLoadCheck passes when MCP marker present in handoff body', () => {
  const { mcpLoadCheck } = require('../scripts/global/collaborator-self-check-rules.js');
  const result = mcpLoadCheck('Used mcp__github__create_issue for the ship', {});
  expect(result.ok).toBe(true);
});

test('mcpLoadCheck passes when opt-out env set and cited in body', () => {
  const { mcpLoadCheck } = require('../scripts/global/collaborator-self-check-rules.js');
  const result = mcpLoadCheck('Skipped MCP because MEGINGJORD_MCP_DISABLED=1; air-gapped operator', { MEGINGJORD_MCP_DISABLED: '1' });
  expect(result.ok).toBe(true);
});

test('mcpLoadCheck fails when opt-out env set but rationale missing', () => {
  const { mcpLoadCheck } = require('../scripts/global/collaborator-self-check-rules.js');
  const result = mcpLoadCheck('Plain body without any opt-out citation here', { MEGINGJORD_MCP_DISABLED: '1' });
  expect(result.ok).toBe(false);
});

test('mcpLoadCheck advisory-passes when no MCP marker and no opt-out set', () => {
  const { mcpLoadCheck } = require('../scripts/global/collaborator-self-check-rules.js');
  const result = mcpLoadCheck('Plain body no markers', {});
  expect(result.ok).toBe(true);
  expect(result.evidence).toContain('advisory');
});

test('mcpLoadCheck detects MCP via plain MCP marker', () => {
  const { mcpLoadCheck } = require('../scripts/global/collaborator-self-check-rules.js');
  const result = mcpLoadCheck('Used MCP server tools', {});
  expect(result.ok).toBe(true);
});

// #2907: checkHandoffHasVerification — hard gate for Pre-handoff verification block.
test('checkHandoffHasVerification: passes when PASS block is present', () => {
  const body = 'COLLABORATOR_HANDOFF\nPre-handoff verification (PASS)\n- [x] `branch-name-prefix` — pass';
  expect(C.checkHandoffHasVerification(body).ok).toBe(true);
});

test('checkHandoffHasVerification: fails when block is missing', () => {
  const result = C.checkHandoffHasVerification('COLLABORATOR_HANDOFF\nsome other content');
  expect(result.ok).toBe(false);
  expect(result.rule).toBe('missing-self-check-verification');
});

test('checkHandoffHasVerification: fails when block shows FAIL', () => {
  const body = 'Pre-handoff verification (FAIL)\n- [ ] `branch-name-prefix` — fail';
  const result = C.checkHandoffHasVerification(body);
  expect(result.ok).toBe(false);
  expect(result.rule).toBe('self-check-verification-failed');
});

test('checkHandoffHasVerification: fails on empty/missing body', () => {
  expect(C.checkHandoffHasVerification('').ok).toBe(false);
  expect(C.checkHandoffHasVerification(null).ok).toBe(false);
});

test('checkHandoffHasVerification: passes on SKIPPED block (waiver)', () => {
  const body = 'Pre-handoff verification: SKIPPED (override-waived)';
  expect(C.checkHandoffHasVerification(body).ok).toBe(true);
});

