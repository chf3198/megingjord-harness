'use strict';
// cross-team-response-fidelity — verifies TEAM_RESPONSE artifacts are
// signed by an operator whose team matches the artifact's `from:` field.
// Catches the cross-team signature-forgery pattern observed in #2360
// rounds 2+3 where the source team posted target-team responses using
// either fabricated or correctly-derived target-team aliases.
//
// Filed under Tier-2 anneal #2370 in response to that drift class.

const { extractArtifactFields, parseTeamModel, expectedAliasFor } = require('./signer-registry-check.js');

const RESPONSE_HEADER_RE = /(^|\n)\s*(?:#{2,3}\s+)?TEAM_RESPONSE\b/i;

function findTeamResponses(comments) {
  return (comments || []).filter(c => RESPONSE_HEADER_RE.test(c.body || ''));
}

function extractFromField(body) {
  const m = (body || '').match(/(?:^|\n)\s*[-*]?\s*(?:\*\*)?from(?:\*\*)?\s*:\s*[`"]?([^`"\n·,]+?)[`"]?(?=\s*[·,\n]|$)/i);
  return m ? m[1].trim().replace(/^[`'"]+|[`'"]+$/g, '').toLowerCase() : null;
}

function checkTeamResponse(body) {
  const violations = [];
  const fromTeam = extractFromField(body);
  if (!fromTeam) {
    violations.push({ rule: 'missing-from-field',
      detail: 'TEAM_RESPONSE missing `from:` target-team field' });
    return violations;
  }
  const fields = extractArtifactFields(body);
  if (!fields.signedBy || !fields.teamModel || !fields.role) {
    violations.push({ rule: 'missing-signing-block',
      detail: 'TEAM_RESPONSE missing Signed-by/Team&Model/Role signing block' });
    return violations;
  }
  const parsed = parseTeamModel(fields.teamModel);
  if (!parsed) {
    violations.push({ rule: 'invalid-team-model',
      detail: `TEAM_RESPONSE Team&Model value '${fields.teamModel}' did not parse as team:model@substrate` });
    return violations;
  }
  if (parsed.team !== fromTeam) {
    violations.push({
      rule: 'team-response-signer-team-mismatch',
      detail: `TEAM_RESPONSE 'from: ${fromTeam}' signed by operator on team '${parsed.team}' ` +
        `(alias '${fields.signedBy}', model '${parsed.model}'). The response must be authored by the target team, ` +
        'not the source team using a target-team alias. See cross-team-artifact-write.instructions.md.',
    });
  }
  const expected = expectedAliasFor({ team: parsed.team, model: parsed.model, role: fields.role.toLowerCase() });
  if (expected && fields.signedBy && fields.signedBy.trim() !== expected) {
    violations.push({
      rule: 'signer-alias-non-derived',
      detail: `TEAM_RESPONSE signer alias '${fields.signedBy}' does not match registry-derived ` +
        `'${expected}' for (${parsed.team}, ${parsed.model}, ${fields.role}).`,
    });
  }
  return violations;
}

function validate(input) {
  const comments = input && input.comments;
  const responses = findTeamResponses(comments);
  const violations = [];
  for (const comment of responses) {
    const found = checkTeamResponse(comment.body || '');
    for (const v of found) {
      violations.push(Object.assign({}, v,
        comment.url ? { source: comment.url } : null,
        comment.id ? { commentId: comment.id } : null));
    }
  }
  return { ok: violations.length === 0, violations };
}

module.exports = { validate, findTeamResponses, extractFromField, checkTeamResponse };
