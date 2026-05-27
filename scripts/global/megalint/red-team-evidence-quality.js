'use strict';

const FILE_REF_RE = /(?:^|[\s`(])([A-Za-z0-9_.-]+(?:\/[A-Za-z0-9_.-]+)+\.[A-Za-z0-9_.-]+)(?=$|[\s`)])/g;
const CHAIN_RE = /(exploit chain|failure chain|attack chain)/i;
const ACCESS_CLAIM_RE = /(access[- ]control|authorization|authz|authn|rbac|acl|permission)/i;
const AUTH_SURFACE_RE = /(auth|oauth|rbac|acl|permission|login|session|token)/i;
const RED_TEAM_MARKER_RE = /(<!--\s*red-team-analysis\s*-->|(^|\n)\s*(?:##\s+)?RED_TEAM_ANALYSIS\b)/i;
const ACCESS_OOS_RE = /out-of-scope:\s*access-control/i;

function extractFileRefs(text) {
  const out = new Set();
  for (const match of String(text || '').matchAll(FILE_REF_RE)) out.add(match[1]);
  return [...out];
}

function isRedTeamArtifact(text) {
  return RED_TEAM_MARKER_RE.test(String(text || ''));
}

function validate(input) {
  const commentBody = String(input.commentBody || '');
  const changedFiles = (input.changedFiles || []).map(String);
  const changedSet = new Set(changedFiles);
  const violations = [];
  const refs = extractFileRefs(commentBody);
  const grounded = refs.filter(ref => changedSet.has(ref));

  if (refs.length === 0) {
    violations.push({
      rule: 'missing-diff-file-reference',
      detail: 'Red-team artifact must cite at least one explicit file path from the changed diff.',
    });
  } else if (grounded.length === 0) {
    violations.push({
      rule: 'no-diff-grounding',
      detail: `Artifact cites file(s) not present in diff: ${refs.join(', ')}`,
    });
  }

  if (!CHAIN_RE.test(commentBody)) {
    violations.push({
      rule: 'missing-failure-chain',
      detail: 'Artifact must include at least one explicit exploit/failure chain statement.',
    });
  }

  const authSurfaceTouched = changedFiles.some(file => AUTH_SURFACE_RE.test(file));
  if (ACCESS_CLAIM_RE.test(commentBody) && !authSurfaceTouched && !ACCESS_OOS_RE.test(commentBody)) {
    violations.push({
      rule: 'missing-access-control-scope',
      detail: 'Access-control claim present without auth-surface diff; add "out-of-scope: access-control".',
    });
  }

  return { ok: violations.length === 0, violations, refs, grounded };
}

module.exports = { validate, extractFileRefs, isRedTeamArtifact };
