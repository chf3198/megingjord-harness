'use strict';
// merge-evidence — Epic #1486 Phase-1a. Pure function that flags issues
// closed as status:done with no merged PR referencing them on main. Caller
// supplies mergedPRRefs (already filtered to merged-to-main); this rule
// stays side-effect-free per existing megalint convention.

const LIGHTWEIGHT_LANES = new Set([
  'lane:docs-research', 'lane:docs-only', 'lane:trivial', 'lane:research',
]);
const OVERRIDE_LABEL = 'merge-evidence-override:approved';

function shouldSkip(labels, state) {
  if (state !== 'closed') return 'open-issue';
  if (labels.includes('type:epic')) return 'epic-evaluated-via-children';
  if (labels.includes('status:cancelled')) return 'cancelled-not-delivered';
  if (!labels.includes('status:done')) return 'non-done-terminal';
  if (labels.includes(OVERRIDE_LABEL)) return 'override-approved';
  for (const label of labels) if (LIGHTWEIGHT_LANES.has(label)) return `lightweight-lane:${label}`;
  return null;
}

function validate(input) {
  const labels = input.labels || [];
  const state = input.state || 'open';
  const mergedPRRefs = input.mergedPRRefs || [];
  const violations = [];

  const skipReason = shouldSkip(labels, state);
  if (skipReason) return { ok: true, violations, skipped: skipReason };

  if (mergedPRRefs.length === 0) {
    violations.push({
      rule: 'merge-evidence-missing',
      detail: 'Issue closed as status:done with no merged PR on main referencing it. '
        + 'Either link the merging PR via Refs #N / Closes #N in the PR body, or apply '
        + `\`${OVERRIDE_LABEL}\` if closure without merge is intentional (cite reason in closing comment).`,
      mergedPRCount: 0,
    });
  }
  return { ok: violations.length === 0, violations, mergedPRCount: mergedPRRefs.length };
}

module.exports = { validate, shouldSkip, LIGHTWEIGHT_LANES, OVERRIDE_LABEL };
