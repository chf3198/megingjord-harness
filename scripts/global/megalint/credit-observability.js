'use strict';
// credit-observability (Epic #3576 W-F, #3586) — ADVISORY. Flags a lane:code-change
// ticket whose MANAGER_HANDOFF lacks `credit_budget:` or whose CONSULTANT_CLOSEOUT lacks
// `free_tier_utilization:`. Never blocks (all findings severity 'advisory') until the
// replay-eval promotion gate — mirrors the flaws-recognized rollout (#3428).
const ADVISORY = 'advisory';

function findArtifact(comments, re) {
  return [...(comments || [])].reverse().find((c) => re.test((c && c.body) || ''));
}

function check(input = {}) {
  const labels = input.labels || [];
  const comments = input.comments || [];
  const violations = [];
  if (!labels.includes('lane:code-change')) return { ok: true, violations };
  const mgr = findArtifact(comments, /##\s*MANAGER_HANDOFF/i);
  const closeout = findArtifact(comments, /##\s*CONSULTANT_CLOSEOUT/i);
  if (mgr && !/credit_budget\s*:/i.test(mgr.body || '')) {
    violations.push({ rule: 'credit-budget-missing', severity: ADVISORY,
      detail: 'MANAGER_HANDOFF lacks credit_budget: (Epic #3576 W-F) — advisory' });
  }
  if (closeout && !/free_tier_utilization\s*:/i.test(closeout.body || '')) {
    violations.push({ rule: 'free-tier-utilization-missing', severity: ADVISORY,
      detail: 'CONSULTANT_CLOSEOUT lacks free_tier_utilization: (Epic #3576 W-F) — advisory' });
  }
  return { ok: violations.length === 0, violations };
}

module.exports = { check };
