'use strict';
// signer-fidelity — rejects issue bodies using client identity for worker artifacts.
// Epic #1407 AC4. Extended in #1451 with registry-derived alias check.

const path = require('path');
const { validateArtifactAlias, loadRegistry, parseTeamModel, extractArtifactFields } = require(path.join(__dirname, 'signer-registry-check.js'));

const CLIENT_IDENTITIES = ['Curtis Franks'];

function findSignerField(body, fieldName = 'Signed-by') {
  const pattern = new RegExp(`${fieldName}\\s*:\\s*([^\\n·,]+?)(?=\\s*[·,\\n]|$)`, 'i');
  const match = (body || '').match(pattern);
  return match ? match[1].trim() : null;
}

function isClientIdentity(name) {
  if (!name) return false;
  return CLIENT_IDENTITIES.some(c => name.trim().toLowerCase() === c.toLowerCase());
}

function checkSignedBy(body) {
  const violations = [];
  const matches = [...body.matchAll(/Signed-by\s*:\s*([^\n·,]+?)(?=\s*[·,\n]|$)/gi)];
  for (const match of matches) {
    if (isClientIdentity(match[1].trim())) {
      violations.push({
        rule: 'client-identity-as-signer',
        detail: `Issue body uses client identity "${match[1].trim()}" as Signed-by — workers must use a worker alias per team-model-signing.instructions.md`,
      });
    }
  }
  return violations;
}

function dedupe(violations) {
  const seen = new Set();
  const unique = [];
  for (const violation of violations) {
    const key = `${violation.rule}::${violation.detail}`;
    if (!seen.has(key)) { seen.add(key); unique.push(violation); }
  }
  return unique;
}

function checkRegistryAlias(body, opts) {
  if (!body) return [];
  const result = validateArtifactAlias(body, opts || {});
  if (result.ok) return [];
  return [result.violation];
}

function extractAIFamily(teamModel) {
  if (!teamModel) return 'unknown';
  const m = (teamModel.match(/[^:]+:([^@]+)@/) || [])[1] || teamModel;
  const s = m.toLowerCase();
  if (s.includes('claude')) return 'anthropic';
  if (/^gpt-|^o[0-9]/.test(s)) return 'openai';
  if (s.includes('qwen')) return 'qwen';
  if (s.includes('deepseek')) return 'deepseek';
  if (s.includes('granite')) return 'granite';
  return 'unknown';
}

function checkConsultantFamilyIndependence(body) {
  if (!body) return [];
  const blocks = [];
  const pat = /Team&Model\s*:\s*([^\n]+)[\s\S]{0,120}?Role\s*:\s*(\w[\w-]*)/gi;
  let match;
  while ((match = pat.exec(body)) !== null) {
    blocks.push({ teamModel: match[1].trim(), role: match[2].toLowerCase() });
  }
  const consult = blocks.find(b => b.role === 'consultant');
  const collab = blocks.find(b => b.role === 'collaborator');
  if (!consult || !collab) return [];
  const cf = extractAIFamily(consult.teamModel);
  const cc = extractAIFamily(collab.teamModel);
  if (cf === 'unknown' || cc === 'unknown' || cf !== cc) return [];
  return [{ rule: 'cross-family-mismatch', severity: 'advisory',
    detail: `Consultant+Collaborator same AI family (${cf}); cross-family review required (#2511)` }];
}

// Substrate-mixing guard (#3671 AC5) — a runtime cannot wear another team's
// Team&Model. Two registry-driven checks, both deterministic:
//   1. substrate-team-mismatch: the substrate resolves (via substrateTeamMap)
//      to team S, but the declared Team&Model team is not S. This catches
//      `codex:gpt-5@cursor-ide` (substrate cursor ⇒ team codex leak).
//   2. signer-seed-team-mismatch: the Signed-by alias seed is uniquely owned by
//      one concrete team T in the registry (e.g. Cyrus ⇒ cursor), but the
//      declared team is not T. This catches a Cursor-derived signer stamped onto
//      a non-cursor Team&Model — the #1591 codex:gpt-5 leak root cause.
function substrateTeamFor(registry, substrate) {
  if (!substrate) return null;
  const map = registry.substrateTeamMap || {};
  const base = String(substrate).toLowerCase().replace(/\/.*$/, '');
  return map[base] || null;
}

function seedOwnerTeams(registry, seed) {
  const wanted = String(seed || '').toLowerCase();
  if (!wanted) return [];
  const teams = new Set();
  for (const entry of registry.registry || []) {
    if (entry.team === '*') continue; // wildcard seeds are shared, not team-unique
    if (String(entry.aliasSeed || '').toLowerCase() === wanted) teams.add(entry.team);
  }
  return [...teams];
}

function checkSubstrateMixing(body, registryOverride) {
  if (!body) return [];
  const registry = loadRegistry(registryOverride);
  if (!registry) return [];
  const { signedBy, teamModel } = extractArtifactFields(body);
  if (!teamModel) return [];
  const parsed = parseTeamModel(teamModel);
  if (!parsed || !parsed.team) return [];
  const violations = [];
  const substrateTeam = substrateTeamFor(registry, parsed.substrate);
  if (substrateTeam && substrateTeam !== parsed.team) {
    violations.push({
      rule: 'substrate-team-mismatch',
      detail: `Team&Model "${teamModel}" declares team=${parsed.team} but substrate `
        + `"${parsed.substrate}" maps to team=${substrateTeam}. A runtime must not sign `
        + `another team's Team&Model (substrate-mixing, #3671 AC5).`,
    });
  }
  const seed = String(signedBy || '').trim().split(/\s+/)[0];
  const owners = seedOwnerTeams(registry, seed);
  if (owners.length === 1 && owners[0] !== parsed.team) {
    violations.push({
      rule: 'signer-seed-team-mismatch',
      detail: `Signed-by seed "${seed}" is registry-unique to team=${owners[0]} but the `
        + `Team&Model declares team=${parsed.team}. A ${owners[0]}-derived signer cannot `
        + `sign a non-${owners[0]} Team&Model (substrate-mixing, #3671 AC5).`,
    });
  }
  return violations;
}

function validate(input) {
  const body = input.body || '';
  const violations = checkSignedBy(body);
  const aiSig = findSignerField(body, 'AI-Signature');
  if (isClientIdentity(aiSig)) violations.push({ rule: 'client-identity-as-ai-signature',
    detail: `Issue body uses client identity "${aiSig}" as AI-Signature trailer` });
  violations.push(...checkRegistryAlias(body, { device: input.device, registryOverride: input.registryOverride }));
  violations.push(...checkSubstrateMixing(body, input.registryOverride));
  violations.push(...checkConsultantFamilyIndependence(body));
  const unique = dedupe(violations);
  return { ok: unique.filter(v => v.severity !== 'advisory').length === 0, violations: unique };
}

// #3688: derive from the cross-family receipt SSoT so the $0 free-cloud panel families
// (meta = groq/llama/cerebras/nvidia/sambanova/openrouter-free, mistral, google = gemini)
// are recognized — a genuine reviewer_family must not trip unknown-reviewer-family.
const { PROVIDER_FAMILY, TEAM_FAMILY } = require(path.join(__dirname, '..', 'cross-family-receipt.js'));
const KNOWN_FAMILIES = [...new Set([
  ...Object.values(PROVIDER_FAMILY), // meta, mistral, google, openai
  ...Object.values(TEAM_FAMILY),     // anthropic, openai, google
  'qwen', 'deepseek', 'granite',     // model-heuristic families (extractAIFamily)
  'unknown',
])];
const normalizeFamily = s => { const n = (s || '').toLowerCase().trim(); return KNOWN_FAMILIES.includes(n) ? n : 'unknown'; };

module.exports = { validate, isClientIdentity, findSignerField, extractAIFamily,
  checkConsultantFamilyIndependence, checkSubstrateMixing, seedOwnerTeams,
  CLIENT_IDENTITIES, KNOWN_FAMILIES, normalizeFamily };
