'use strict';
// signer-format-canonical — Epic #1526 follow-up (#1536). Two checks:
//   1. Reject role-prefix provenance lines like
//      "Manager: <name> | <agent> | <date>" — the anti-pattern Copilot
//      Team used in Epic #1526. The canonical form is the 3-line
//      Signed-by + Team&Model + Role block from team-model-signing.
//   2. When Signed-by is present, require a canonical Team&Model line
//      matching <team>:<model>@<substrate>[/<device>] per the registry
//      teamModelSpec.
// Pure function. Caller (label-lint or per-issue megalint dispatch)
// supplies input.body.

// Anti-pattern: a line beginning with capital role-as-key plus at least one
// pipe separator. Capital prefix + pipes is the tell of the Copilot
// Manager:/Collaborator: provenance format. A lowercase "manager:" in
// narrative prose, or a heading like "## Manager", does NOT match.
const ROLE_PREFIX_PROVENANCE_RE =
  /^\s*(Manager|Collaborator|Admin|Consultant):\s+\S+(\s+\|\s+|\s+\|$)/m;

// Canonical Team&Model: <team>:<model>@<substrate>[/<device>]
const TEAM_MODEL_CANONICAL_RE =
  /Team&Model:\s*([a-z][a-z0-9-]*):([\w.+-]+)@([a-z][a-z0-9-]*)(?:\/([a-z0-9-]+))?/i;

const VIOLATION_LINE_PREVIEW_LEN = 120;
const DETAIL_LINE_PREVIEW_LEN = 80;

function findRolePrefixProvenance(body) {
  const out = [];
  for (const line of (body || '').split('\n')) {
    if (ROLE_PREFIX_PROVENANCE_RE.test(line)) out.push(line.trim());
  }
  return out;
}

function hasCanonicalTeamModel(body) {
  return TEAM_MODEL_CANONICAL_RE.test(body || '');
}

function hasSignedBy(body) {
  return /^[ \t]*Signed-by:\s*\S+/im.test(body || '');
}

function validate(input) {
  const body = input.body || '';
  const violations = [];

  for (const line of findRolePrefixProvenance(body)) {
    violations.push({
      rule: 'role-prefix-as-provenance',
      detail: `Non-canonical provenance line: "${line.slice(0, DETAIL_LINE_PREVIEW_LEN)}". `
        + `Use the canonical 3-line block (Signed-by: <alias> / Team&Model: <team>:<model>@<substrate> / Role: <role>) `
        + `per instructions/team-model-signing.instructions.md.`,
      line: line.slice(0, VIOLATION_LINE_PREVIEW_LEN),
    });
  }

  if (hasSignedBy(body) && !hasCanonicalTeamModel(body)) {
    violations.push({
      rule: 'team-model-not-canonical',
      detail: 'Body contains Signed-by but Team&Model line is missing or '
        + 'malformed. Expected: Team&Model: <team>:<model>@<substrate>[/<device>].',
    });
  }

  return { ok: violations.length === 0, violations };
}

module.exports = {
  validate, findRolePrefixProvenance, hasCanonicalTeamModel, hasSignedBy,
  ROLE_PREFIX_PROVENANCE_RE, TEAM_MODEL_CANONICAL_RE,
};
