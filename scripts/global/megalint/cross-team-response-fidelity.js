'use strict';
// cross-team-response-fidelity — verifies TEAM_RESPONSE artifacts are
// signed by an operator whose team matches the artifact's `from:` field.
// Catches the cross-team signature-forgery pattern observed in #2360
// rounds 2+3 where the source team posted target-team responses using
// either fabricated or correctly-derived target-team aliases.
//
// Filed under Tier-2 anneal #2370 in response to that drift class.
// #2912: promoted from advisory to hard-blocking after soak completion.
// soak_counter: 1 (soak complete)

const { extractArtifactFields, parseTeamModel, expectedAliasFor } = require('./signer-registry-check.js');

const RESPONSE_HEADER_RE = /(^|\n)\s*(?:#{2,3}\s+)?TEAM_RESPONSE\b/i;

function findTeamResponses(comments) {
  return (comments || []).filter(c => RESPONSE_HEADER_RE.test(c.body || ''));
}

function extractFromField(body) {
  const m = (body || '').match(/(?:^|\n)\s*[-*]?\s*(?:\*\*)?from(?:\*\*)?\s*:\s*[`"]?([^`"\n·,]+?)[`"]?(?=\s*[·,\n]|$)/i);
  return m ? m[1].trim().replace(/^[`'"]+|[`'"]+$/g, '').toLowerCase() : null;
}

function checkSignerTeamMismatch(parsed, fromTeam, signedBy) {
  if (parsed.team === fromTeam) return null;
  return {
    rule: 'team-response-signer-team-mismatch', severity: 'hard',
    detail: `TEAM_RESPONSE 'from: ${fromTeam}' signed by operator on team '${parsed.team}' ` +
      `(alias '${signedBy}', model '${parsed.model}'). The response must be authored by ` +
      'the target team, not the source team using a target-team alias.',
  };
}

function checkAliasDerivation(parsed, role, signedBy) {
  const expected = expectedAliasFor({ team: parsed.team, model: parsed.model, role: role.toLowerCase() });
  if (!expected || !signedBy) return null;
  if (signedBy.trim().toLowerCase() === expected.toLowerCase()) return null;
  return {
    rule: 'signer-alias-non-derived', severity: 'hard',
    detail: `TEAM_RESPONSE signer alias '${signedBy}' does not match registry-derived ` +
      `'${expected}' for (${parsed.team}, ${parsed.model}, ${role}).`,
  };
}

function checkTeamResponse(body) {
  const violations = [];
  const fromTeam = extractFromField(body);
  if (!fromTeam) return [{ rule: 'missing-from-field', severity: 'hard',
    detail: 'TEAM_RESPONSE missing `from:` target-team field' }];
  const fields = extractArtifactFields(body);
  if (!fields.signedBy || !fields.teamModel || !fields.role) return [{ rule: 'missing-signing-block', severity: 'hard',
    detail: 'TEAM_RESPONSE missing Signed-by/Team&Model/Role signing block' }];
  const parsed = parseTeamModel(fields.teamModel);
  if (!parsed) return [{ rule: 'invalid-team-model', severity: 'hard',
    detail: `TEAM_RESPONSE Team&Model value '${fields.teamModel}' did not parse as team:model@substrate` }];
  const mismatch = checkSignerTeamMismatch(parsed, fromTeam, fields.signedBy);
  if (mismatch) violations.push(mismatch);
  const aliasDrift = checkAliasDerivation(parsed, fields.role, fields.signedBy);
  if (aliasDrift) violations.push(aliasDrift);
  return violations;
}

function validate(input) {
  const comments = input && input.comments;
  const responses = findTeamResponses(comments);
  const violations = [];
  for (const comment of responses) {
    for (const violation of checkTeamResponse(comment.body || '')) {
      violations.push(Object.assign({}, violation,
        comment.url ? { source: comment.url } : null,
        comment.id ? { commentId: comment.id } : null));
    }
  }
  return { ok: violations.length === 0, violations };
}

module.exports = { validate, findTeamResponses, extractFromField, checkTeamResponse };
