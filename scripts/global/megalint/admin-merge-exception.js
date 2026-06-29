#!/usr/bin/env node
'use strict';
// tier: 1
// admin-merge-exception (Epic #2517 AC1): an admin-BYPASS merge (a PR merged despite not all
// required checks green / required review met — i.e. branch protection was overridden, as
// `gh pr merge --admin` does) must carry a formal exception: a `merge-bypass:admin-exception`
// label on the linked issue OR a `BLOCKER_NOTE` with `bypass_reason:` + `approver:` in the PR body.
// Pure logic (unit-testable); the CI caller supplies the merge metadata (`adminBypass`).

const EXCEPTION_LABEL = 'merge-bypass:admin-exception';
const BLOCKER_RE = /BLOCKER_NOTE/i;
const BYPASS_REASON_RE = /bypass_reason\s*:/i;
const APPROVER_RE = /approver\s*:/i;

// A bypass = the PR merged WITHOUT satisfying branch protection (admin override).
// `reviewApproved` only signals a bypass when review is ACTUALLY required by branch
// protection — this single-operator harness governs via baton artifacts + required
// status checks, not GitHub PR-review approvals, so a missing approval is the normal
// state and must not be read as a bypass (#3347).
function detectAdminBypass(prData = {}) {
  if (!prData.merged) return false;
  if (prData.requiredChecksAllGreen === false) return true;
  return prData.reviewRequired === true && prData.reviewApproved === false;
}

// Pure helper: are the REQUIRED checks all green on a SHA? Scoped to the branch's
// required contexts so advisory / non-required check_runs (incl. this gate's own
// run) never count as an override. No required contexts -> nothing to bypass (#3347).
function computeRequiredChecksGreen(checkRuns = [], requiredContexts = []) {
  if (!requiredContexts.length) return true;
  const required = new Set(requiredContexts);
  return (checkRuns || [])
    .filter((run) => required.has(run.name))
    .every((run) => ['success', 'skipped', 'neutral'].includes(run.conclusion));
}

function hasException(labels = [], prBody = '') {
  if ((labels || []).includes(EXCEPTION_LABEL)) return true;
  const body = String(prBody || '');
  return BLOCKER_RE.test(body) && BYPASS_REASON_RE.test(body) && APPROVER_RE.test(body);
}

function adminMergeExceptionCheck(ctx = {}) {
  const violations = [];
  if (ctx.bypassDetected && !hasException(ctx.labels, ctx.prBody)) {
    violations.push({
      rule: 'admin-merge-without-exception',
      detail: `admin-bypass merge requires the '${EXCEPTION_LABEL}' label on the linked issue `
        + 'OR a BLOCKER_NOTE with bypass_reason: + approver: in the PR body',
    });
  }
  return { ok: violations.length === 0, violations };
}

// megalint interface: no-op unless the CI caller supplied merge metadata.
const validate = (input = {}) => adminMergeExceptionCheck({
  bypassDetected: input.adminBypass !== undefined ? Boolean(input.adminBypass) : detectAdminBypass(input.prData || {}),
  labels: input.labels || [],
  prBody: input.prBody || '',
});

module.exports = {
  detectAdminBypass, computeRequiredChecksGreen, adminMergeExceptionCheck,
  hasException, validate, EXCEPTION_LABEL,
};
