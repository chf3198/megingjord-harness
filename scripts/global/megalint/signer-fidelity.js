'use strict';
// signer-fidelity — rejects issue bodies using client identity for worker artifacts.
// Epic #1407 AC4. Extended in #1451 with registry-derived alias check.

const path = require('path');
const { validateArtifactAlias } = require(path.join(__dirname, 'signer-registry-check.js'));

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

function validate(input) {
  const body = input.body || '';
  const violations = checkSignedBy(body);
  const aiSig = findSignerField(body, 'AI-Signature');
  if (isClientIdentity(aiSig)) violations.push({ rule: 'client-identity-as-ai-signature',
    detail: `Issue body uses client identity "${aiSig}" as AI-Signature trailer` });
  violations.push(...checkRegistryAlias(body, { device: input.device, registryOverride: input.registryOverride }));
  violations.push(...checkConsultantFamilyIndependence(body));
  const unique = dedupe(violations);
  return { ok: unique.filter(v => v.severity !== 'advisory').length === 0, violations: unique };
}

module.exports = { validate, isClientIdentity, findSignerField, extractAIFamily,
  checkConsultantFamilyIndependence, CLIENT_IDENTITIES };
