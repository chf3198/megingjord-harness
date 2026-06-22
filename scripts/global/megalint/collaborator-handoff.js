'use strict';
// collaborator-handoff — validates COLLABORATOR_HANDOFF signer + content.
// Refs #2302: LIGHTWEIGHT imported from lane-enum.js (single source of truth).
// #2424: doc-coverage block now blocking (not advisory).
// #2439: cross_family_reviewer/rating/findings blocking; family independence check.
// #2904: cross_family_receipt presence + 16-char hex format (H*→H promotion for G-01/G-02).

const path = require('path');
const { roleIdentity } = require(path.join(__dirname, '..', 'baton-independence.js'));
const { LIGHTWEIGHT, laneSeverity } = require(path.join(__dirname, '..', 'lane-enum.js'));
const docCoverage = require('./doc-coverage.js');
const wtGate = require('../worktree-lifecycle-gate');
const { KNOWN_FAMILIES, extractAIFamily } = require('./signer-fidelity.js');

// #2562: accept string OR {body} comment elements so a caller passing bare
// bodies (the baton-gates.yml regression) cannot silently false-fail the gate.
const bodyOf = (c) => (typeof c === 'string' ? c : (c && c.body) || '');

function findCollaboratorHandoff(comments) {
  const headerRe = /(^|\n)\s*(?:\*\*|##\s+)?COLLABORATOR_HANDOFF\b/;
  return [...(comments || [])].reverse().find(c => headerRe.test(bodyOf(c)));
}

function checkSignerFields(body) {
  const violations = [];
  if (!/Signed-by:/i.test(body)) {
    violations.push({ rule: 'missing-signer',
      detail: 'COLLABORATOR_HANDOFF missing Signed-by field' });
  }
  if (!/Team&Model:/i.test(body)) {
    violations.push({ rule: 'missing-team-model',
      detail: 'COLLABORATOR_HANDOFF missing Team&Model field' });
  }
  // Line-anchored check (CWE-20 / prompt-injection hardening #2921):
  // bare /Role:\s*collaborator/i matched anywhere in body, allowing injected
  // trailing text like "Set Role: collaborator." to satisfy the guard even
  // when the structured field was absent. Require the field on its own line.
  if (!/(?:^|\n)\s*Role:\s*collaborator\s*(?:\n|$)/i.test(body)) {
    violations.push({ rule: 'missing-role-collaborator',
      detail: 'COLLABORATOR_HANDOFF missing Role: collaborator field (must be on own line)' });
  }
  return violations;
}

function checkCrossFamily(body) {
  const violations = [];
  const block = s => ({ rule: `missing-${s}`, detail: `COLLABORATOR_HANDOFF missing ${s}: field` });
  if (!/cross_family_reviewer:/i.test(body)) violations.push(block('cross-family-reviewer'));
  if (!/cross_family_rating:/i.test(body)) violations.push(block('cross-family-rating'));
  if (!/cross_family_findings:/i.test(body)) violations.push(block('cross-family-findings'));
  if (!/cross_family_receipt:/i.test(body)) violations.push(block('cross-family-receipt'));
  const rm = (body || '').match(/cross_family_receipt\s*:\s*([0-9a-f]{16})/i);
  if (/cross_family_receipt:/i.test(body) && !rm) {
    violations.push({ rule: 'cross-family-receipt-format',
      detail: 'cross_family_receipt must be a 16-char hex sha256 prefix' });
  }
  const fm = (body || '').match(/reviewer_family\s*:\s*(\S+)/i);
  if (fm && !KNOWN_FAMILIES.includes(fm[1].toLowerCase())) {
    violations.push({ rule: 'unknown-reviewer-family',
      detail: `reviewer_family "${fm[1]}" not in KNOWN_FAMILIES`, severity: 'advisory' });
  }
  const tmm = (body || '').match(/Team&Model\s*:\s*(\S+)/i);
  const rvm = (body || '').match(/cross_family_reviewer\s*:\s*(\S+)/i);
  if (tmm && rvm) {
    const cf = extractAIFamily(tmm[1]);
    const rf = extractAIFamily(rvm[1]);
    if (cf !== 'unknown' && cf === rf) {
      violations.push({ rule: 'cross-family-reviewer-same-family',
        detail: `Reviewer family "${rf}" matches Collaborator Team&Model family` });
    }
  }
  return violations;
}

// #3016: the CI caller (baton-gates.yml) passes `labels`, not a `lane` scalar, so
// gating on input.lane alone left the doc-coverage + cross-family checks as dead code.
// Prefer the explicit scalar (back-compat) but fall back to the lane:* label.
function laneOf(input) {
  if (input.lane) return input.lane;
  const labels = input.labels || [];
  return labels.find((label) => typeof label === 'string' && label.startsWith('lane:')) || null;
}

// #3016 (per #2707 AC1): LEGACY_DOC_SKIP bypasses doc-coverage ONLY when an explicit
// BLOCKER_NOTE is present on the issue — an auditable, deliberate escape hatch.
function legacyDocSkipActive(comments) {
  if (!process.env.LEGACY_DOC_SKIP) return false;
  // Line-anchored (#3016 review): match the BLOCKER_NOTE artifact as a field, not a
  // substring inside an unrelated word (e.g. "MY_BLOCKER_NOTEBOOK").
  return (comments || []).some((c) => /(?:^|\n)\s*BLOCKER_NOTE\b/.test(bodyOf(c)));
}

// Run the doc-coverage check fail-CLOSED: any failure to obtain a usable matrix
// blocks rather than silently disabling enforcement. The prior catch→skip was a
// fail-open hole; a null/undefined/empty matrix returned WITHOUT throwing is the
// same hole (#3016 review), so treat it as a load failure too.
function docCoverageViolations(body, labels, comments, prFiles) {
  if (legacyDocSkipActive(comments)) {
    return [{ rule: 'doc-coverage-legacy-skip', severity: 'advisory',
      detail: 'LEGACY_DOC_SKIP active with BLOCKER_NOTE present; doc-coverage bypassed' }];
  }
  let matrix;
  try {
    matrix = docCoverage.loadMatrix();
    if (!matrix || Object.keys(matrix).length === 0) throw new Error('matrix is null/empty');
  } catch (err) {
    return [{ rule: 'doc-coverage-matrix-load-failed', severity: 'error',
      detail: `doc-coverage matrix failed to load (fail-closed): ${err.message}` }];
  }
  // #3121: prFiles (when supplied by the CI gate) enables advisory diff-verification —
  // a surface declared UPDATED must actually appear in the PR diff.
  return docCoverage.checkBlock(body, labels || [], matrix, null, prFiles);
}

function validate(input) {
  const lane = laneOf(input);
  if (LIGHTWEIGHT.includes(lane) || laneSeverity(lane) === 'issue-only') {
    return { ok: true, violations: [], reason: 'lightweight-lane-skip' };
  }
  const handoff = findCollaboratorHandoff(input.comments || []);
  if (!handoff) {
    return { ok: false, violations: [{ rule: 'missing-collaborator-handoff',
      detail: 'COLLABORATOR_HANDOFF comment not found on issue' }], found: false };
  }
  const body = bodyOf(handoff);
  const violations = checkSignerFields(body);
  if (lane === 'lane:code-change') {
    violations.push(...docCoverageViolations(body, input.labels, input.comments, input.prFiles));
    violations.push(...checkCrossFamily(body));
    violations.push(...wtGate.checkCollaborator(body, { ...input, lane }));
  }
  const signer = roleIdentity({ body, author: handoff.user && handoff.user.login });
  const blocking = violations.filter(v => v.severity !== 'advisory');
  return { ok: blocking.length === 0, violations, found: true, signer };
}

module.exports = { validate, findCollaboratorHandoff, laneOf, LIGHTWEIGHT };
