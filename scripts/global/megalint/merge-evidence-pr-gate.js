'use strict';
// merge-evidence-pr-gate — Epic #1486 Phase-1c. PR-merge-time validator
// that promotes merge-evidence from advisory to required. Ensures every
// non-lightweight, non-epic PR commits to atomically closing its linked
// issue via GitHub auto-close keywords (Closes/Fixes/Resolves), or carries
// the merge-evidence-override:approved label on the issue.
// Refs #2302: LIGHTWEIGHT_LANES imported from lane-enum.js (single source of truth).

const path = require('path');
const { LIGHTWEIGHT_LANES } = require(path.join(__dirname, '..', 'lane-enum.js'));
const OVERRIDE_LABEL = 'merge-evidence-override:approved';
const CLOSE_KEYWORDS_RE = /\b(close[sd]?|fix(es|ed)?|resolve[sd]?)\s+#(\d+)/gi;

function findCloseTargets(prBody) {
  const out = new Set();
  if (!prBody) return out;
  for (const m of prBody.matchAll(CLOSE_KEYWORDS_RE)) out.add(parseInt(m[3], 10));
  return out;
}

function shouldSkip(labels) {
  if (labels.includes('type:epic')) return 'epic-bypass';
  if (labels.includes(OVERRIDE_LABEL)) return 'override-approved';
  for (const label of labels) if (LIGHTWEIGHT_LANES.has(label)) return `lightweight-lane:${label}`;
  return null;
}

function validate(input) {
  const labels = input.labels || [];
  const issueNumber = input.issueNumber;
  const prBody = input.prBody || '';
  if (!issueNumber) return { ok: true, violations: [], skipped: 'no-issue-context' };

  const skipReason = shouldSkip(labels);
  if (skipReason) return { ok: true, violations: [], skipped: skipReason };

  const closeTargets = findCloseTargets(prBody);
  if (closeTargets.has(Number(issueNumber))) {
    return { ok: true, violations: [], closeTargets: [...closeTargets] };
  }
  return {
    ok: false,
    violations: [{
      rule: 'merge-evidence-pr-gate-missing',
      detail: `PR body must include a GitHub auto-close keyword for issue #${issueNumber} `
        + `(e.g. "Closes #${issueNumber}"). This commits the PR to closing the issue on merge, `
        + `which is the merge evidence the harness will then validate. Override via `
        + `\`${OVERRIDE_LABEL}\` on the issue if closure-without-merge is intentional.`,
      issueNumber, closeTargetsFound: [...closeTargets],
    }],
  };
}

module.exports = {
  validate, findCloseTargets, shouldSkip,
  LIGHTWEIGHT_LANES, OVERRIDE_LABEL, CLOSE_KEYWORDS_RE,
};
