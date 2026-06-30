'use strict';
// consultant-closeout — schema, signature, rubric, and Tier-3 checks.

const path = require('path');
const fs = require('fs');
const { findManagerHandoff, extractField } = require('./manager-handoff');
const sig = require(path.join(__dirname, '..', 'governance-artifact-signature.js'));
const { enforceTier3Emission } = require(path.join(__dirname, 'goal-failure-emission.js'));
const { fleetCloseoutParity } = require(path.join(__dirname, '..', 'governance-bundle.js'));
const wtGate = require('../worktree-lifecycle-gate');
const { checkMemoryNoteRecurrence } = require(path.join(__dirname, '..', 'closeout-recurrence-guard.js'));
const { checkRubricVerdictConsistency } = require('./consultant-rubric-consistency.js');

// #2094 AC-4: parity for a fleet-authored CLOSEOUT. Same standard as non-fleet
// — a CLOSEOUT that cites a governance-bundle-hash must trace to a hash-valid,
// fast-TTL-fresh bundle (provided via input.governanceBundle). Absent the
// marker this is a no-op, so non-fleet CLOSEOUTs are unchanged.
function checkFleetBundleProvenance(body, input) {
  const cited = ((body || '').match(/governance-bundle-hash:\s*([0-9a-f]{64})/i) || [])[1];
  if (!cited) return [];
  if (!input || !input.governanceBundle) {
    return [{ rule: 'fleet-bundle-unverifiable', severity: 'advisory',
      detail: 'CLOSEOUT cites governance-bundle-hash but no bundle was supplied to verify provenance.' }];
  }
  const parity = fleetCloseoutParity(body, input.governanceBundle, input.nowMs || Date.now());
  return parity.ok ? [] : [{ rule: 'fleet-bundle-parity-failed', detail: `fleet CLOSEOUT bundle parity: ${parity.reason}` }];
}

function findConsultantCloseout(comments) {
  const headerRe = /(^|\n)\s*(?:\*\*|##\s+)?CONSULTANT_CLOSEOUT(?:_EPIC_CLOSEOUT)?\b/;
  return [...(comments || [])].reverse().find(c => headerRe.test(c.body || ''));
}

function checkSignerFields(body) {
  const violations = [];
  if (!/Signed-by:/i.test(body)) violations.push({ rule: 'missing-signer', detail: 'CONSULTANT_CLOSEOUT missing Signed-by field' });
  if (!/Team&Model:/i.test(body)) violations.push({ rule: 'missing-team-model', detail: 'CONSULTANT_CLOSEOUT missing Team&Model field' });
  // Line-anchored (CWE-20 / prompt-injection hardening #2921 — mirrors collaborator-handoff.js fix).
  if (!/(?:^|\n)\s*Role:\s*consultant\s*(?:\n|$)/i.test(body)) violations.push({ rule: 'missing-role-consultant', detail: 'CONSULTANT_CLOSEOUT missing Role: consultant field (must be on own line)' });
  return violations;
}

function checkEvidenceFields(body) {
  const violations = [];
  const legacyRubric = /G[1-9]\s*[=:]/i.test(body);
  const structuredRubric = /rubric_version["']?\s*[:=]\s*["']?g1-g9-v2/i.test(body)
    && /boxes_checked/i.test(body) && /boxes_total/i.test(body);
  // #1811 + #1750: accept rubric_provisional flag while Epic #1745 calibration corpus is built.
  // The flag must coexist with SOME rubric form (legacy or structured) — it cannot replace rubric entirely.
  const provisional = /rubric_provisional["']?\s*[:=]\s*["']?true/i.test(body)
    || /provisional["']?\s*[:=]\s*["']?true/i.test(body);
  if (!legacyRubric && !structuredRubric && !provisional) {
    violations.push({ rule: 'missing-rubric', detail: 'CONSULTANT_CLOSEOUT missing legacy G1-9 rubric or v2 deterministic rubric JSON or rubric_provisional:true marker (Epic #1745).' });
  }
  if (provisional && !legacyRubric && !structuredRubric) {
    violations.push({ rule: 'rubric-provisional-advisory', severity: 'advisory', detail: 'rubric_provisional:true accepted in advisory mode pending Epic #1745 calibration corpus. Include legacy or structured rubric alongside the flag.' });
  }
  if (!/verification[ _-]?timestamp/i.test(body)) violations.push({ rule: 'missing-verification-timestamp', detail: 'CONSULTANT_CLOSEOUT missing verification-timestamp field' });
  if (!/(verdict|approve|approved)/i.test(body)) violations.push({ rule: 'missing-verdict', detail: 'CONSULTANT_CLOSEOUT missing explicit verdict / approve statement' });
  return violations;
}

/**
 * checkRequiredFlawFields — hard-blocking gate for flaw-accounting fields (#2909).
 *
 * The baton-routing contract (role-baton-routing.instructions.md §"review → done") requires
 * every CONSULTANT_CLOSEOUT to declare anneal_tickets_filed and mid_flight_flaws so that
 * the recurrence detector and closeout-schema validator have reliable signal. Absence of
 * either field is a G1 governance violation (missing evidence = silent pass, fail-open).
 *
 * Accepted forms:
 *   anneal_tickets_filed: [#N, ...] | none
 *   mid_flight_flaws: [...] | none
 *
 * @param {string} body
 * @returns {{ rule: string, detail: string }[]}
 */
// A required closeout field has a value when it is non-empty on the same line
// (`field: value`) OR on the immediately-following line — the canonical
// baton-comment-build format renders longer values on the next line. A next
// line that is itself another `Key:` field is treated as bleed, not a value,
// so a genuinely-empty field is still caught (#2909, builder-compat fix).
function flawFieldState(body, field) {
  if (typeof body !== 'string') return 'missing'; // non-string body → field is absent (fail-closed)
  // Anchor the field to line-start (after optional whitespace) so a longer token like
  // `prefix_<field>:` does not satisfy the check (cross-family review #2909).
  const match = body.match(
    new RegExp(`(?:^|\\n)[ \\t]*${field}[ \\t]*:[ \\t]*([^\\n\\r]*)(?:\\r?\\n[ \\t]*([^\\n\\r]*))?`, 'i'));
  if (!match) return 'missing';
  if ((match[1] || '').trim()) return 'ok';
  const next = (match[2] || '').trim();
  if (next && !/^[A-Za-z][\w&-]*[ \t]*:/.test(next)) return 'ok';
  return 'empty';
}

function checkRequiredFlawFields(body) {
  const violations = [];
  const fields = [
    ['anneal_tickets_filed', 'declare [#N,...] or none'],
    ['mid_flight_flaws', 'declare [...] or none'],
  ];
  for (const [field, hint] of fields) {
    const state = flawFieldState(body, field);
    const key = field.replace(/_/g, '-');
    if (state === 'missing') {
      violations.push({ rule: `missing-${key}`,
        detail: `CONSULTANT_CLOSEOUT missing ${field} field (required; ${hint})` });
    } else if (state === 'empty') {
      violations.push({ rule: `empty-${key}`,
        detail: `CONSULTANT_CLOSEOUT ${field} has no value (${hint})` });
    }
  }
  return violations;
}

function checkCrypto(body) {
  if (!/Crypto-Algorithm:/i.test(body)) return [];
  const result = sig.verifyArtifact(body, 'consultant');
  return result.ok ? [] : result.violations.map(v => ({ rule: 'crypto-signature-invalid', detail: `CONSULTANT_CLOSEOUT ${v}` }));
}

function checkTier3Emission(body, input) {
  if (!input.ticketRef) return [];
  const result = enforceTier3Emission(body, input.ticketRef, input.incidentsPath);
  return result.violations;
}

function checkGovTokenResolution(body, input) {
  const catalog = path.join(__dirname, '..', '..', '..', 'instructions', 'governance-controls.instructions.md');
  let known;
  try { known = new Set((fs.readFileSync(catalog, 'utf8').match(/\bGOV-\d{3}\b/g) || [])); }
  catch { return [{ rule: 'missing-governance-catalog', detail: 'instructions/governance-controls.instructions.md not found' }]; }
  const text = [input.body || '', input.prBody || '', body || ''].join('\n');
  const unresolved = [...new Set((text.match(/\bGOV-\d{3}\b/g) || []))].filter(t => !known.has(t));
  return unresolved.map(t => ({ rule: 'unresolved-governance-token', detail: `Token ${t} has no catalog source in instructions/governance-controls.instructions.md` }));
}

function checkSubstantiveContent(body, isEpic) {
  if (!isEpic) return [];
  const b = body || '';
  if (/(?:^|[\s(\[,;])#\d{2,5}\b/.test(b) || /\b(?:PR|pull[\/\\]|pull\s+request)\s*#?\d+|pull\/\d+/i.test(b) || /research\/[\w-]+\.md/i.test(b)) return [];
  return [{ rule: 'epic-closeout-no-substantive-evidence', detail: 'CONSULTANT_CLOSEOUT on an Epic must reference: (a) #N child ref, (b) PR ref, (c) research/*.md — see #1453.' }];
}

function checkCrossRuntimeWritesPending(comments) {
  const handoff = findManagerHandoff(comments || []);
  if (!handoff) return [];
  const crw = extractField(handoff.body || '', 'cross_runtime_writes');
  if (!crw || !crw.trim() || /^none$/i.test(crw.trim())) return [];
  if (/target_team_sign_off\s*:\s*pending/i.test(handoff.body || '')) {
    return [{
      rule: 'cross-runtime-sign-off-pending',
      detail: 'CONSULTANT_CLOSEOUT blocked: MANAGER_HANDOFF cross_runtime_writes has ' +
        'target_team_sign_off: pending. All cross-runtime writes require a resolved ' +
        'sign-off before closeout. Refs #2911.',
    }];
  }
  return [];
}

function checkCrossFamilyVerdict(body) {
  if (!/cross_family_verdict:/i.test(body)) return [{ rule: 'cross-family-verdict-missing', severity: 'advisory', detail: 'CONSULTANT_CLOSEOUT: cross_family_verdict field missing (advisory; #2537)' }];
  if (!/cross_family_verdict:\s*(ACCEPT|PARTIAL|REJECT)\s*[—–-]+\s*\S+@\S+\s*[—–-]+\s*.+/i.test(body)) return [{ rule: 'cross-family-verdict-malformed', detail: 'cross_family_verdict must be: ACCEPT|PARTIAL|REJECT — <model@host> — <rationale>' }];
  return [];
}

// #2266: positive issue-only closeout evidence schema for `lane:no-code-remediation`.
// Epic #2258's no-code lane shipped via #2264/#2265/#2268, but the surrounding validators
// (merge-evidence, admin-handoff, branch-name) only *silently exempt* the issue-only lane.
// This turns that silent exemption into an EXPLICIT, auditable declaration: a no-code
// CONSULTANT_CLOSEOUT must positively state `N/A` for each surface it skips (PR, merge,
// CI, deploy) so "no evidence existed" can never be mistaken for "evidence was omitted".
// Gated strictly on the authoritative GitHub label (input.labels), never on body text, so
// a code-change closeout cannot forge the reduced schema (anti-over-accept, #2266 AC5).
// Non-no-code lanes are a no-op (#2266 AC4). Verdict/rubric/flaw fields stay required for
// ALL lanes via the universal checks in validate() (#2266 AC3).
const NO_CODE_REMEDIATION_LANE = 'lane:no-code-remediation';
const ISSUE_ONLY_NA_SURFACES = Object.freeze([
  { key: 'pr',     label: 'PR',     re: /(?:^|\n)[ \t]*(?:pr|pull[- ]?request|pr-evidence)[ \t]*:[ \t]*n\/?a\b/i },
  { key: 'merge',  label: 'merge',  re: /(?:^|\n)[ \t]*merge(?:[- ]?evidence)?[ \t]*:[ \t]*n\/?a\b/i },
  { key: 'ci',     label: 'CI',     re: /(?:^|\n)[ \t]*(?:ci|ci[- ]?checks|checks)[ \t]*:[ \t]*n\/?a\b/i },
  { key: 'deploy', label: 'deploy', re: /(?:^|\n)[ \t]*(?:deploy|deploy[- ]?runtime[- ]?impact|sync[- ]?verification)[ \t]*:[ \t]*n\/?a\b/i },
]);

// checkIssueOnlyEvidenceSchema — #2266 AC1/AC2. Returns one violation per surface whose
// explicit N/A declaration is missing on a lane:no-code-remediation closeout.
function checkIssueOnlyEvidenceSchema(body, input) {
  const labels = (input && input.labels) || [];
  if (!labels.includes(NO_CODE_REMEDIATION_LANE)) return [];
  const advisory = process.env.NO_CODE_EVIDENCE_SCHEMA_ADVISORY === '1';
  const text = typeof body === 'string' ? body : '';
  return ISSUE_ONLY_NA_SURFACES
    .filter(surface => !surface.re.test(text))
    .map(surface => {
      const violation = {
        rule: `issue-only-${surface.key}-na-missing`,
        detail: `lane:no-code-remediation CONSULTANT_CLOSEOUT must explicitly declare `
          + `\`${surface.label}: N/A\` — issue-only remediation has no ${surface.label} surface, `
          + `and silent omission is not accepted. See #2266 and `
          + `docs/howto/no-code-remediation-workflow.md. `
          + `Rollback: NO_CODE_EVIDENCE_SCHEMA_ADVISORY=1 demotes to advisory.`,
      };
      if (advisory) violation.severity = 'advisory';
      return violation;
    });
}

function validate(input) {
  const closeout = findConsultantCloseout(input.comments || []);
  if (!closeout) {
    return { ok: false, violations: [{ rule: 'missing-consultant-closeout', detail: 'CONSULTANT_CLOSEOUT comment not found on issue' }], found: false };
  }
  const body = closeout.body || '';
  const violations = [
    ...checkSignerFields(body),
    ...checkEvidenceFields(body),
    ...checkRubricVerdictConsistency(body),
    ...checkRequiredFlawFields(body),
    ...checkCrypto(body),
    ...checkTier3Emission(body, input),
    ...checkMemoryNoteRecurrence(body, { incidentsPath: input.incidentsPath }),
    ...checkGovTokenResolution(body, input),
    ...checkSubstantiveContent(body, input.isEpic === true),
    ...checkCrossFamilyVerdict(body),
    ...checkFleetBundleProvenance(body, input),
    ...checkCrossRuntimeWritesPending(input.comments),
    ...checkIssueOnlyEvidenceSchema(body, input),
    ...wtGate.checkConsultant(body, input),
  ];
  return { ok: violations.filter(v => v.severity !== 'advisory').length === 0, violations, found: true };
}

module.exports = {
  validate,
  findConsultantCloseout,
  // flawFieldState reused by megalint/flaws-recognized.js (line-anchored field parser). Epic #3425.
  flawFieldState,
  checkCrossFamilyVerdict,
  checkFleetBundleProvenance,
  checkRequiredFlawFields,
  checkMemoryNoteRecurrence,
  checkRubricVerdictConsistency,
  checkCrossRuntimeWritesPending,
  checkIssueOnlyEvidenceSchema,
};
