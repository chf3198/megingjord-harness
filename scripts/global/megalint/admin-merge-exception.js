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
function detectAdminBypass(prData = {}) {
  if (!prData.merged) return false;
  return prData.requiredChecksAllGreen === false || prData.reviewApproved === false;
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

module.exports = { detectAdminBypass, adminMergeExceptionCheck, hasException, validate, EXCEPTION_LABEL };
