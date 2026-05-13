'use strict';
// merge-evidence-reconciler — Epic #1486 Phase-1b. Batches closed-issue
// items through the merge-evidence rule and returns a remediation plan.
// Pure(ish): callers provide GitHub data; this module produces decisions.
// The caller (cron workflow) applies labels and posts comments.

const rule = require('./megalint/merge-evidence.js');

const DEFAULT_BATCH_SIZE = 20;
const COMMENT_MARKER = '<!-- merge-evidence-reconciler -->';
const VIOLATION_LABEL = 'governance:close-without-merge';

function classifyItem(item, buckets) {
  if (!item || typeof item.issue !== 'object') return;
  const issue = item.issue;
  const result = rule.validate({
    state: issue.state,
    labels: (issue.labels || []).map(l => typeof l === 'string' ? l : l.name),
    mergedPRRefs: item.mergedPRRefs || [],
  });
  const entry = { number: issue.number, title: issue.title };
  if (result.skipped) buckets.skipped.push({ ...entry, reason: result.skipped });
  else if (!result.ok) buckets.violations.push({ ...entry, violations: result.violations });
  else buckets.passed.push({ ...entry, mergedPRCount: result.mergedPRCount });
}

function reconcile(items, opts = {}) {
  if (!Array.isArray(items)) throw new TypeError('items must be an array');
  const batchSize = opts.batchSize || DEFAULT_BATCH_SIZE;
  const batch = items.slice(0, batchSize);
  const buckets = { violations: [], skipped: [], passed: [] };
  for (const item of batch) classifyItem(item, buckets);
  return {
    processed: batch.length,
    remaining: Math.max(0, items.length - batch.length),
    ...buckets,
    label: VIOLATION_LABEL,
    marker: COMMENT_MARKER,
  };
}

function buildComment(item) {
  return `${COMMENT_MARKER}\n## Merge-evidence advisory\n\n`
    + `Issue closed as \`status:done\` with no merged PR on main referencing it. `
    + `Per Epic #1486, every non-lightweight \`status:done\` ticket should carry merge evidence.\n\n`
    + `**To resolve:**\n`
    + `1. If a merging PR exists but was not detected, ensure its body cites \`Refs #${item.number}\` or \`Closes #${item.number}\`.\n`
    + `2. If closure without merge is intentional, apply label \`merge-evidence-override:approved\` and cite reason in a closing comment.\n\n`
    + `_Advisory only — no enforcement. Phase-1c may promote to required after soak. See Epic #1486._`;
}

module.exports = {
  reconcile, buildComment, DEFAULT_BATCH_SIZE, COMMENT_MARKER, VIOLATION_LABEL,
};
