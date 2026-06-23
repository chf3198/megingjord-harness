'use strict';
// tier: 1
// collaborator-self-check — Epic #1568 AC-2 (#1571), #2907 (hard-gate promotion).
// Entry-point that dispatches the 10 deterministic pre-handoff checks defined in
// collaborator-self-check-rules.js. Caller passes pre-extracted data; helper runs
// no commands itself (keeps it pure).
// Exit 1 CLI mode: COLLABORATOR_SELF_CHECK_SKIP=1 to bypass (documented opt-out
// for non-code-change lanes; emits advisory warning when used).

const { loadLocalEnvOnce } = require('./load-local-env.js');
loadLocalEnvOnce();
const Rules = require('./collaborator-self-check-rules.js');

const OVERRIDE_LABEL = 'collaborator-self-check:waived';

/**
 * Check that a COLLABORATOR_HANDOFF body contains a self-check evidence block.
 * Used by megalint/collaborator-handoff.js to enforce the hard gate (AC3 #2907).
 * @param {string} handoffBody - raw text of the COLLABORATOR_HANDOFF comment
 * @returns {{ ok: boolean, rule: string, detail: string }}
 */
function checkHandoffHasVerification(handoffBody) {
  const body = (typeof handoffBody === 'string') ? handoffBody : '';
  if (!body) {
    return { ok: false, rule: 'missing-self-check-verification',
      detail: 'COLLABORATOR_HANDOFF body is empty or missing' };
  }
  if (!/Pre-handoff verification/i.test(body)) {
    return { ok: false, rule: 'missing-self-check-verification',
      detail: 'COLLABORATOR_HANDOFF missing "Pre-handoff verification" block — run runChecks() and paste formatChecks() output into handoff' };
  }
  if (/Pre-handoff verification.*FAIL/i.test(body)) {
    return { ok: false, rule: 'self-check-verification-failed',
      detail: 'COLLABORATOR_HANDOFF "Pre-handoff verification" block shows FAIL — fix failing checks before advancing to Admin' };
  }
  return { ok: true, rule: 'self-check-verification', detail: 'Pre-handoff verification block present and not FAIL' };
}

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

/**
 * CLI entry point — exits 1 when runChecks returns ok=false.
 * Opt-out: set COLLABORATOR_SELF_CHECK_SKIP=1 (non-code-change lanes).
 * Emits advisory warning on stderr when the skip opt-out is used.
 * Hard-gate promotion per #2907 (advisory → blocking).
 */
if (require.main === module) {
  if (process.env.COLLABORATOR_SELF_CHECK_SKIP === '1') {
    process.stderr.write('[collaborator-self-check] SKIPPED via COLLABORATOR_SELF_CHECK_SKIP=1 (advisory-only opt-out)\n');
    process.exit(0);
  }
  // In CLI mode the caller must supply JSON input via stdin or env.
  // Without a full GitHub context the check cannot run all validations,
  // but we enforce the invariant: exit 0 only if input.ok is true.
  // Pre-push mode: read JSON from COLLABORATOR_SELF_CHECK_INPUT env var.
  const rawInput = process.env.COLLABORATOR_SELF_CHECK_INPUT;
  if (!rawInput) {
    process.stderr.write('[collaborator-self-check] No COLLABORATOR_SELF_CHECK_INPUT env var; pass JSON or use the CI workflow gate.\n');
    process.exit(0); // No context = not a gate violation (CI gate handles server-side)
  }
  let input;
  try { input = JSON.parse(rawInput); } catch (err) {
    process.stderr.write(`[collaborator-self-check] Invalid JSON in COLLABORATOR_SELF_CHECK_INPUT: ${err.message}\n`);
    process.exit(1);
  }
  const result = runChecks(input);
  process.stdout.write(formatChecks(result) + '\n');
  if (!result.ok) {
    process.stderr.write('[collaborator-self-check] FAIL — resolve failing checks before creating PR\n');
    process.exit(1);
  }
  process.exit(0);
}

module.exports = { runChecks, formatChecks, CHECKS, OVERRIDE_LABEL, shouldSkip, checkHandoffHasVerification };
