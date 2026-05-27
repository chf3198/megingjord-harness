'use strict';
// signer-registry-check — verifies Signed-by aliases match the registry-derived
// alias for the declared Team&Model + Role. Epic flaw #1451.
// Registry source: inventory/team-model-signatures.json (read once, cached).

const fs = require('fs');
const path = require('path');

const REGISTRY_PATH = path.join(__dirname, '..', '..', '..', 'inventory', 'team-model-signatures.json');
let cachedRegistry = null;

function loadRegistry(overridePath) {
  if (overridePath) return JSON.parse(fs.readFileSync(overridePath, 'utf-8'));
  if (cachedRegistry) return cachedRegistry;
  if (!fs.existsSync(REGISTRY_PATH)) return null;
  cachedRegistry = JSON.parse(fs.readFileSync(REGISTRY_PATH, 'utf-8'));
  return cachedRegistry;
}

function parseTeamModel(teamModel) {
  const match = (teamModel || '').match(/^([^:]+):([^@]+)@?(\S*)$/);
  if (!match) return null;
  return { team: match[1].toLowerCase(), model: match[2].toLowerCase(), substrate: match[3] };
}

function matchRegistryEntry(registry, team, model, device) {
  for (const entry of registry.registry || []) {
    const teamOk = entry.team === '*' || entry.team === team;
    if (!teamOk) continue;
    const modelOk = new RegExp(entry.modelPattern, 'i').test(model);
    if (!modelOk) continue;
    const deviceOk = !entry.devicePattern || new RegExp(entry.devicePattern, 'i').test(device || '');
    if (deviceOk) return entry;
  }
  return null;
}

function expectedAliasFor({ team, model, role, device, registryOverride }) {
  const registry = loadRegistry(registryOverride);
  if (!registry || !team || !model || !role) return null;
  const entry = matchRegistryEntry(registry, team, model, device);
  const seed = entry ? entry.aliasSeed : registry.defaultAliasSeed;
  const surname = (registry.roleSurnames || {})[role];
  if (!seed || !surname) return null;
  return `${seed} ${surname}`;
}

function extractArtifactFields(body) {
  const text = body || '';
  const field = (label, value) => {
    const pattern = new RegExp(`(?:^|[·,\\n])\\s*${label}\\s*:\\s*(${value})`, 'gm');
    const matches = [...text.matchAll(pattern)];
    return matches.length ? matches[matches.length - 1][1] : null;
  };
  const signedBy = field('Signed-by', '[^·,\\n]+');
  const teamModel = field('Team&Model', '\\S+');
  const role = field('Role', '\\w+');
  return {
    signedBy: signedBy ? signedBy.trim() : null,
    teamModel,
    role: role ? role.toLowerCase() : null,
  };
}

function validateArtifactAlias(body, opts = {}) {
  const fields = extractArtifactFields(body);
  if (!fields.signedBy || !fields.teamModel || !fields.role) {
    return { ok: true, skipped: 'missing-required-fields', fields };
  }
  const parsed = parseTeamModel(fields.teamModel);
  if (!parsed) return { ok: true, skipped: 'unparseable-team-model', fields };
  const expected = expectedAliasFor({
    team: parsed.team, model: parsed.model, role: fields.role,
    device: opts.device, registryOverride: opts.registryOverride,
  });
  if (!expected) return { ok: true, skipped: 'no-registry-entry', fields };
  if (fields.signedBy.toLowerCase() === expected.toLowerCase()) {
    return { ok: true, expected, actual: fields.signedBy };
  }
  return {
    ok: false,
    expected,
    actual: fields.signedBy,
    violation: {
      rule: 'signer-alias-not-registry-derived',
      detail: `Signed-by "${fields.signedBy}" does not match registry-derived alias "${expected}" for ${fields.teamModel} role=${fields.role}. Use scripts/global/agent-signature.js to derive correct alias.`,
    },
  };
}

module.exports = {
  loadRegistry, parseTeamModel, matchRegistryEntry, expectedAliasFor,
  extractArtifactFields, validateArtifactAlias, REGISTRY_PATH,
};
