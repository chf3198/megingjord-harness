#!/usr/bin/env node
'use strict';
// tier: 1
// fleet-review-required (Epic #2192 / #2738): HARD-GATE that makes cross-family
// fleet/free-cloud review non-skippable at Consultant phase. Promotes the
// fleet-review contract from instruction (advisory) to enforcement (G1), and by
// mandating the free fleet/free-cloud lane it is the Epic's G3 payoff. Registered
// as an `enforced` link in config/governance-chains.yml (self-enforced by #2709's
// chain-integrity.js). 3-fact anti-forgery (Phase-0 #2193): cross-family +
// verdict-format + dispatch-provenance. Pure logic (unit-testable).
//
// Epic #3411 T3.3 (#3453): harness SSoT catalog/descriptor/runtime-descriptor paths
// are now a SECOND trigger surface. A PR touching these paths requires a cross-family
// review on the COLLABORATOR_HANDOFF (cross_family_reviewer + 16-hex cross_family_receipt
// with family independence). Prefer qwen-32b fleet-first for reviews; any non-author
// family satisfies the gate.

const LANES_REQUIRING_REVIEW = new Set(['area:governance', 'area:scripts', 'area:hooks']);

// Exact paths and prefix pattern for the harness SSoT catalog surface (#3453).
const CATALOG_EXACT_PATHS = new Set([
  'inventory/harness-feature-catalog.json',
  'inventory/runtime-descriptor.schema.json',
]);
const CATALOG_RUNTIMES_PREFIX = 'inventory/runtimes/';
const CATALOG_RUNTIMES_SUFFIX = '.json';

const REVIEWER_RE = /cross_family_reviewer:\s*([^\s@]+@[^\s]+)/i;
const VERDICT_RE = /cross_family_verdict:\s*(ACCEPT|PARTIAL|REJECT)\s*[-—–]+\s*\S+@\S+\s*[-—–]+\s*.+/i;
const RECEIPT_RE = /cross_family_receipt\s*:\s*([0-9a-f]{16})/i;
const COLLAB_REVIEWER_RE = /cross_family_reviewer\s*:\s*(\S+)/i;

const FAMILY = [
  [/claude|opus|sonnet|haiku|anthropic/i, 'anthropic'],
  [/gpt|codex|openai/i, 'openai'],
  [/gemini|google/i, 'google'],
  [/qwen|alibaba/i, 'alibaba'],
  [/llama|meta/i, 'meta'],
  [/mistral|mixtral/i, 'mistral'],
];

function modelFamily(text) {
  const found = FAMILY.find(([re]) => re.test(String(text || '')));
  return found ? found[1] : 'unknown';
}

function laneRequiresReview(labels = []) {
  return (labels || []).some((label) => LANES_REQUIRING_REVIEW.has(label));
}

// Returns true when filePath is one of the harness SSoT catalog/descriptor/runtimes paths.
function isCatalogPath(filePath) {
  const normalized = String(filePath || '').replace(/\\/g, '/');
  if (CATALOG_EXACT_PATHS.has(normalized)) return true;
  return normalized.startsWith(CATALOG_RUNTIMES_PREFIX)
    && normalized.endsWith(CATALOG_RUNTIMES_SUFFIX);
}

// Returns true when at least one path in the changedFiles array is a catalog SSoT path.
function catalogPathRequiresReview(changedFiles = []) {
  return (changedFiles || []).some((filePath) => isCatalogPath(filePath));
}

// Returns a violation when the 16-hex cross_family_receipt field is absent or malformed.
function checkCatalogReceipt(body) {
  if (RECEIPT_RE.test(body)) return null;
  return {
    rule: 'catalog-review-missing-receipt',
    detail: 'COLLABORATOR_HANDOFF on a catalog SSoT change must carry cross_family_receipt: '
      + '<16-hex sha256 prefix> confirming dispatch provenance',
  };
}

// Returns a violation when the reviewer family is absent, unknown, or matches the author family.
function checkCatalogFamilyIndependence(reviewerString, authorTeamModel) {
  const authorFamily = modelFamily(authorTeamModel);
  const reviewerFamily = modelFamily(reviewerString);
  if (reviewerFamily === 'unknown' || reviewerFamily === authorFamily) {
    return {
      rule: 'catalog-review-not-cross-family',
      detail: `catalog reviewer family '${reviewerFamily}' must differ from author family `
        + `'${authorFamily}' (no same-family self-review on SSoT catalog edits)`,
    };
  }
  return null;
}

// Validate the COLLABORATOR_HANDOFF body for catalog-surface cross-family review evidence.
// Enforces: cross_family_reviewer present, family-independent from author, 16-hex receipt.
function validateCatalogHandoff(handoffBody, authorTeamModel) {
  const violations = [];
  const body = String(handoffBody || '');
  const reviewerMatch = body.match(COLLAB_REVIEWER_RE);
  if (!reviewerMatch) {
    violations.push({
      rule: 'catalog-review-missing-reviewer',
      detail: 'COLLABORATOR_HANDOFF on a catalog SSoT change must carry cross_family_reviewer: '
        + '(prefer qwen2.5-coder:32b fleet-first, any non-author family satisfies the gate)',
    });
  }
  const receiptViolation = checkCatalogReceipt(body);
  if (receiptViolation) violations.push(receiptViolation);
  if (reviewerMatch) {
    const familyViolation = checkCatalogFamilyIndependence(reviewerMatch[1], authorTeamModel);
    if (familyViolation) violations.push(familyViolation);
  }
  return violations;
}

// Runs the lane-based CONSULTANT_CLOSEOUT check and returns any violations.
function laneGateViolations(ctx) {
  const violations = [];
  const body = String(ctx.closeoutBody || '');
  const reviewer = (body.match(REVIEWER_RE) || [])[1];
  if (!reviewer || !VERDICT_RE.test(body)) {
    violations.push({ rule: 'fleet-review-missing',
      detail: 'CONSULTANT_CLOSEOUT on a review-required lane must carry cross_family_reviewer + '
        + 'cross_family_verdict (ACCEPT|PARTIAL|REJECT - model@host - rationale)' });
    return violations;
  }
  const authorFamily = modelFamily(ctx.authorTeamModel);
  const reviewerFamily = modelFamily(reviewer);
  if (reviewerFamily === 'unknown' || reviewerFamily === authorFamily) {
    violations.push({ rule: 'fleet-review-not-cross-family',
      detail: `reviewer family '${reviewerFamily}' must differ from author family '${authorFamily}' (no same-family self-review)` });
  }
  if (ctx.dispatchRecorded === false) {
    violations.push({ rule: 'fleet-review-no-dispatch-record',
      detail: 'no HAMR/fleet/free-cloud dispatch record found for the claimed review (forgery guard)' });
  }
  return violations;
}

function validate(ctx = {}) {
  const violations = [];
  if (laneRequiresReview(ctx.labels)) {
    violations.push(...laneGateViolations(ctx));
  }
  if (catalogPathRequiresReview(ctx.changedFiles)) {
    const handoffBody = String(ctx.collaboratorHandoffBody || '');
    violations.push(...validateCatalogHandoff(handoffBody, ctx.authorTeamModel));
  }
  return { ok: violations.length === 0, violations };
}

module.exports = {
  validate,
  modelFamily,
  laneRequiresReview,
  catalogPathRequiresReview,
  isCatalogPath,
  validateCatalogHandoff,
  LANES_REQUIRING_REVIEW,
  CATALOG_EXACT_PATHS,
  CATALOG_RUNTIMES_PREFIX,
};

if (require.main === module) {
  console.log('fleet-review-required: validator module (invoked by CI with closeout context)');
}
