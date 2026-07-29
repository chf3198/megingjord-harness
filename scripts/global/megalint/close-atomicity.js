'use strict';
// close-atomicity (Epic #3576 W-C, #3582) — ADVISORY. Flags a CONSULTANT_CLOSEOUT that
// asserts terminal completion while the re-read issue state is not CLOSED (open-done race,
// E10). Uses input.issueState/labels when the caller supplies them; never blocks.
const { completionClaimGuard } = require('../close-atomicity-gate.js');
const ADVISORY = 'advisory';
function findArtifact(comments, re) {
  return [...(comments || [])].reverse().find((c) => re.test((c && c.body) || ''));
}
function validate(input = {}) {
  const violations = [];
  const closeout = findArtifact(input.comments, /##\s*CONSULTANT_CLOSEOUT/i);
  if (!closeout || input.issueState === undefined) return { ok: true, violations };
  const guard = completionClaimGuard(closeout.body, { issueState: input.issueState,
    labels: input.labels, openBatonBack: input.openBatonBack });
  if (guard.blocked) {
    violations.push({ rule: 'close-atomicity-open-done', severity: ADVISORY, detail: guard.detail });
  }
  return { ok: violations.length === 0, violations };
}
module.exports = { validate, check: validate };
