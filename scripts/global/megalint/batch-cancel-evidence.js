#!/usr/bin/env node
'use strict';
// tier: 1
// batch-cancel-evidence (Epic #2517 AC2): when a single PR closes >1 issue and any of the
// closing issues is CANCELLED (resolution:cancelled / status:cancelled / closed not_planned),
// each cancelled issue must carry an explicit `CANCELLATION: <reason>` comment (the `any → cancelled`
// transition contract in role-baton-routing.instructions.md). Batch COMPLETIONS keep using the
// existing `resolved as part of batch with #N` marker (batch-evidence.js) — this gate is for the
// cancellation path only. Pure logic; the CI caller supplies the closing issues' state + comments.

const CLOSES_RE = /\b(?:closes|fixes|resolves)\s+#(\d{2,6})\b/gi;
// Accepts the contract form `CANCELLATION: <reason>` AND the heading/bold marker form
// (`## CANCELLATION ...` / `**CANCELLATION**`); bare prose "cancellation" does not match.
const CANCELLATION_RE = /(^|\n)\s*(?:(?:\*\*|##\s+)CANCELLATION\b|CANCELLATION\s*:)/i;

function parseCloses(prBody = '') {
  const out = new Set();
  const re = new RegExp(CLOSES_RE);
  let match;
  while ((match = re.exec(String(prBody || '')))) out.add(Number(match[1]));
  return [...out];
}

function isCancelled(issue = {}) {
  if (issue.cancelled === true) return true;
  const labels = issue.labels || [];
  return labels.includes('resolution:cancelled') || labels.includes('status:cancelled')
    || issue.state_reason === 'not_planned';
}

function hasCancellationComment(issue = {}) {
  return (issue.comments || []).some((c) => CANCELLATION_RE.test(c.body || ''));
}

function batchCancelCheck(closingIssues = []) {
  const violations = [];
  if ((closingIssues || []).length > 1) {
    for (const issue of closingIssues) {
      if (isCancelled(issue) && !hasCancellationComment(issue)) {
        violations.push({
          rule: 'batch-cancel-missing-cancellation',
          detail: `#${issue.number} closed as cancelled in a multi-close (>1 issue) but has no `
            + "'CANCELLATION: <reason>' comment",
        });
      }
    }
  }
  return { ok: violations.length === 0, violations };
}

// megalint interface: no-op unless the CI caller supplied the closing issues.
const validate = (input = {}) => batchCancelCheck(input.closingIssues || []);

module.exports = { parseCloses, batchCancelCheck, isCancelled, hasCancellationComment, validate, CANCELLATION_RE };
