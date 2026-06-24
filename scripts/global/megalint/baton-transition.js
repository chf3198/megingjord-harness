'use strict';
// baton-transition — validates BATON_TRANSITION + post-transition identity (#3031 C3).
const { extractArtifactFields, parseTeamModel } = require('./signer-registry-check');
const { extractField } = require('./artifact-field-extract');

const HEADER = /(^|\n)\s*(?:\*\*|##\s+)?BATON_TRANSITION\b/;

function findLatest(comments) {
  let latest = null;
  for (const c of comments || []) {
    const body = String((c && c.body) || c || '');
    if (HEADER.test(body)) latest = body;
  }
  return latest;
}

function validateTransition(body) {
  const violations = [];
  const fields = extractArtifactFields(body);
  const toTeam = extractField(body, 'to_team');
  const parsed = parseTeamModel(fields.teamModel || '');
  if (!toTeam || !parsed) {
    violations.push({ rule: 'baton-transition-incomplete', detail: 'BATON_TRANSITION requires to_team + Signed-by Team&Model' });
    return { ok: false, violations };
  }
  if (parsed.team !== String(toTeam).toLowerCase()) {
    violations.push({
      rule: 'baton-transition-team-mismatch',
      detail: `Team&Model team '${parsed.team}' must match to_team '${toTeam}'`,
      severity: 'hard',
    });
  }
  return { ok: violations.length === 0, violations, toTeam: parsed.team };
}

function validate(input) {
  const body = findLatest(input.comments || []);
  if (!body) return { ok: true, skipped: 'no-baton-transition', found: false };
  const result = validateTransition(body);
  return { ...result, found: true };
}

module.exports = { validate, findLatest, validateTransition, HEADER };
