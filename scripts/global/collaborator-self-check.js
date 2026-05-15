'use strict';
// collaborator-self-check — Epic #1568 AC-2 (#1571). Entry-point that dispatches
// the 10 deterministic pre-handoff checks defined in collaborator-self-check-rules.js.
// Caller passes pre-extracted data; helper runs no commands itself (keeps it pure).

const Rules = require('./collaborator-self-check-rules.js');

const OVERRIDE_LABEL = 'collaborator-self-check:waived';

const CHECKS = [
  { id: 'branch-name-prefix', fn: i => Rules.branchNamePrefix(i.branchName) },
  { id: 'refs-this-ticket-first', fn: i => Rules.refsThisTicketFirst(i.prBody, i.ticketNumber) },
  { id: 'closes-and-refs-both-present', fn: i => Rules.closesAndRefsBothPresent(i.prBody, i.ticketNumber) },
  { id: 'tdd-spec-in-diff-when-required', fn: i => Rules.tddSpecInDiffWhenRequired(i.testStrategy, i.prFiles) },
  { id: 'no-prose-colon-collision', fn: i => Rules.noProseColonCollision(i.handoffBody) },
  { id: 'no-markdown-bold-on-test-strategy', fn: i => Rules.noMarkdownBoldOnTestStrategy(i.handoffBody) },
  { id: 'flaw-marker-citations', fn: i => Rules.flawMarkerCitations(i.handoffBody) },
  { id: 'readability-no-new-warnings', fn: i => Rules.readabilityNoNewWarnings(i.readabilityWarnings) },
  { id: 'all-acceptance-criteria-ticked', fn: i => Rules.allAcceptanceCriteriaTicked(i.managerHandoffBody, i.handoffBody) },
  { id: 'model-diversity-prospective-admin', fn: i => Rules.modelDiversityProspectiveAdmin(i.ownTeamModel, i.prospectiveAdminTeamModel) },
];

function shouldSkip(labels) {
  return (labels || []).includes(OVERRIDE_LABEL) ? 'override-waived' : null;
}

function runChecks(input) {
  const skipReason = shouldSkip(input.labels);
  if (skipReason) return { ok: true, checks: [], skipped: skipReason };
  const checks = CHECKS.map(c => c.fn(input || {}));
  return { ok: checks.every(c => c.ok), checks };
}

function formatChecks(result) {
  if (result.skipped) return `Pre-handoff verification: SKIPPED (${result.skipped})`;
  const lines = result.checks.map(c => `- ${c.ok ? '[x]' : '[ ]'} \`${c.id}\` — ${c.evidence}`);
  return `Pre-handoff verification (${result.ok ? 'PASS' : 'FAIL'})\n${lines.join('\n')}`;
}

module.exports = { runChecks, formatChecks, CHECKS, OVERRIDE_LABEL, shouldSkip };
