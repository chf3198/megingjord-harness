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
  // #3681: iterate over the REQUIRED contexts, not over the runs present. A required
  // context with no terminal-green run (missing / pending / never reported) is NOT green
  // — the old `filter(...).every(...)` returned true for an absent context ([].every===true),
  // so a genuine --admin bypass on a never-green required check was reported as PASS.
  const byName = new Map((checkRuns || []).map((run) => [run.name, run]));
  return requiredContexts.every((ctx) => {
    const run = byName.get(ctx);
    return Boolean(run) && ['success', 'skipped', 'neutral'].includes(run.conclusion);
  });
}

// #3701 AC1: an exception's `approver:` that resolves to the SAME operator as the PR's
// merging admin is a self-approval — approving your own bypass is not an approval.
function approverIsIndependent(prBody = '', mergedBy = '') {
  const m = String(prBody || '').match(/approver\s*:\s*([^\n]+)/i);
  const approver = m ? m[1].trim().toLowerCase() : '';
  const merger = String(mergedBy || '').trim().toLowerCase();
  if (!approver || !merger) return true; // cannot compare -> do not false-positive
  return approver !== merger;
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
  // #3701 AC1: an excepted bypass whose approver is the merging admin is a self-approval.
  if (ctx.bypassDetected && hasException(ctx.labels, ctx.prBody)
    && !approverIsIndependent(ctx.prBody, ctx.mergedBy)) {
    violations.push({
      rule: 'admin-bypass-self-approved',
      detail: 'bypass approver resolves to the merging admin — approving your own bypass '
        + 'is not an approval; a distinct operator must approve (#3701)',
    });
  }
  return { ok: violations.length === 0, violations };
}

// megalint interface: no-op unless the CI caller supplied merge metadata.
const validate = (input = {}) => adminMergeExceptionCheck({
  bypassDetected: input.adminBypass !== undefined ? Boolean(input.adminBypass) : detectAdminBypass(input.prData || {}),
  labels: input.labels || [],
  prBody: input.prBody || '',
  mergedBy: input.mergedBy || (input.prData && input.prData.mergedBy) || '',
});

module.exports = {
  detectAdminBypass, computeRequiredChecksGreen, adminMergeExceptionCheck,
  hasException, approverIsIndependent, validate, EXCEPTION_LABEL,
};
