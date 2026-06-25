'use strict';
// author-team-check — GitHub comment author vs declared Team&Model team (#3032 C4).
const fs = require('fs');
const path = require('path');
const { parseTeamModel } = require('./signer-registry-check');
const { extractArtifactFields } = require('./signer-registry-check');

const MAP_PATH = path.join(__dirname, '..', '..', '..', 'inventory', 'github-actor-team-map.json');

function loadMap() {
  if (!fs.existsSync(MAP_PATH)) return {};
  return JSON.parse(fs.readFileSync(MAP_PATH, 'utf8')).actors || {};
}

function authorTeam(login) {
  if (!login) return null;
  return loadMap()[String(login).toLowerCase()] || null;
}

function checkComment(body, login) {
  const fields = extractArtifactFields(body);
  if (!fields.teamModel) return { ok: true, skipped: 'no-team-model' };
  const parsed = parseTeamModel(fields.teamModel);
  const expected = authorTeam(login);
  if (!expected || !parsed) return { ok: true, skipped: 'unmapped-author' };
  if (expected.toLowerCase() === parsed.team) return { ok: true };
  return {
    ok: false,
    violation: {
      rule: 'author-team-mismatch',
      detail: `GitHub author '${login}' maps to team '${expected}' but artifact declares '${parsed.team}'`,
      severity: 'hard',
    },
  };
}

function validate(input) {
  const violations = [];
  for (const comment of input.comments || []) {
    const checkResult = checkComment(comment.body || comment, comment.user?.login || comment.author || '');
    if (!checkResult.ok && checkResult.violation) violations.push(checkResult.violation);
  }
  return { ok: violations.length === 0, violations };
}

module.exports = { validate, checkComment, authorTeam, MAP_PATH };
