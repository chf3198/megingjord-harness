'use strict';
// phase0-promotion-resolver — GitHub data layer for the Phase-0 -> Phase-1
// promotion gate (Epic #2678). Resolves an Epic's labels, comments, and
// validated children into the shape phase0GreenComplete() consumes.
//
// Sub-issues API is unavailable on this repo plan (per #2679), so child
// linkage is candidate-#N refs (Epic body + EPIC_RESCOPE comment tables)
// filtered by a back-reference check: a candidate is only a child if it
// carries a phase-gate label AND its own body references this Epic. The
// back-ref filter stops unrelated #N mentions (e.g. a "Refs #3256" note in an
// analysis comment) from being mis-counted as Phase-0/Phase-1 children.

const { phase0GreenComplete } = require('./megalint/phase0-promotion-gate.js');
const { verifyReceipt } = require('./cross-family-receipt.js');

const MAX_CANDIDATES = 80;

// #3826 (Epic #3822 C2, Gap B): the committed plan-rating fields. A verified
// cross-family receipt binds the numeric scores; the gate reads them
// deterministically (offline) — it never re-runs models in CI.
const PLAN_RATING_RECEIPT_RE = /plan_rating_receipt\s*:\s*([0-9a-f]{16})/i;
const PLAN_RATING_MEDIAN_RE = /plan_rating_median\s*:\s*(\d{1,3})/i;
const PLAN_RATING_FAMILIES_RE = /plan_rating_distinct_families\s*:\s*(\d+)/i;
const PLAN_RATING_GWET_RE = /plan_rating_gwet_ac1\s*:\s*(-?\d*\.?\d+)/i;

// Parse the FIRST committed PLAN_RATING / EPIC_RESCOPE block carrying a receipt.
function parsePlanRating(comments) {
  for (const c of comments || []) {
    const body = (c && c.body) || '';
    const rm = body.match(PLAN_RATING_RECEIPT_RE);
    if (!rm) continue;
    const num = (re) => { const m = body.match(re); return m ? Number(m[1]) : NaN; };
    return {
      receipt: rm[1].toLowerCase(),
      median: num(PLAN_RATING_MEDIAN_RE),
      families: num(PLAN_RATING_FAMILIES_RE),
      gwet: num(PLAN_RATING_GWET_RE),
    };
  }
  return null;
}

// Structural (un-forgeable receipt) -> semantic (>=90 numeric + §D4 validity floor).
// STRUCTURAL alone catches the #3808 class (no receipt), forged, and single-family;
// SEMANTIC enforces the >=90 gate. Tests inject opts.ledger; production reads the
// committed governance/cross-family-consensus.jsonl via verifyReceipt's default.
function hasVerifiedPlanRatingReceipt(epicNumber, comments, opts = {}) {
  const verify = opts.verifyReceipt || verifyReceipt;
  const parsed = parsePlanRating(comments);
  if (!parsed || !parsed.receipt) return { ok: false, reason: 'no-plan-rating-receipt' };
  const structural = verify(epicNumber, parsed.receipt, opts.authoringFamily || 'anthropic',
    { kind: 'review', minFamilies: 2, ledger: opts.ledger, ledgerPath: opts.ledgerPath });
  if (!structural.ok) return { ok: false, reason: `receipt-${structural.reason}`, parsed };
  if (!(parsed.median >= 90)) return { ok: false, reason: `median-below-90:${parsed.median}`, parsed };
  if (!(parsed.families >= 3)) return { ok: false, reason: `distinct-families-below-3:${parsed.families}`, parsed };
  if (!(parsed.gwet >= 0.6)) return { ok: false, reason: `gwet-ac1-below-floor:${parsed.gwet}`, parsed };
  return {
    ok: true, reason: 'plan-rating-verified',
    median: parsed.median, families: parsed.families, gwet: parsed.gwet, panel: structural.panel,
  };
}

function parseRefs(text) {
  return [...new Set((String(text || '').match(/#(\d+)/g) || []).map((m) => Number(m.slice(1))))];
}

function collectCandidateRefs(epic, comments, epicNumber) {
  const fromBody = parseRefs(epic && epic.body);
  const fromComments = (comments || []).flatMap((c) => parseRefs(c && c.body));
  return [...new Set([...fromBody, ...fromComments])]
    .filter((n) => n !== epicNumber)
    .slice(0, MAX_CANDIDATES);
}

function childBackrefsEpic(childBody, epicNumber) {
  if (parseRefs(childBody).includes(epicNumber)) return true;
  return new RegExp(`\\bParent:\\s*#${epicNumber}\\b`).test(String(childBody || ''));
}

function hasPhaseGateLabel(labels) {
  return labels.includes('phase-gate:phase-1') || labels.includes('phase-gate:research-first');
}

async function loadChild(github, owner, repo, n, epicNumber) {
  const data = (await github.rest.issues.get({ owner, repo, issue_number: n })).data;
  const labels = (data.labels || []).map((l) => l.name);
  if (!hasPhaseGateLabel(labels)) return null;
  if (!childBackrefsEpic(data.body, epicNumber)) return null;
  // Only Phase-0 (research-first, non-phase-1) children need comments (closeout check).
  let comments = [];
  if (labels.includes('phase-gate:research-first') && !labels.includes('phase-gate:phase-1')) {
    comments = await github.paginate(github.rest.issues.listComments, {
      owner, repo, issue_number: n, per_page: 100,
    });
  }
  return { number: n, state: data.state, labels, comments };
}

async function resolve({ github, owner, repo, epicNumber, ledger, ledgerPath }) {
  const epic = (await github.rest.issues.get({ owner, repo, issue_number: epicNumber })).data;
  const labels = (epic.labels || []).map((l) => l.name);
  const comments = await github.paginate(github.rest.issues.listComments, {
    owner, repo, issue_number: epicNumber, per_page: 100,
  });
  const refs = collectCandidateRefs(epic, comments, epicNumber);
  const children = [];
  for (const n of refs) {
    try {
      const child = await loadChild(github, owner, repo, n, epicNumber);
      if (child) children.push(child);
    } catch (e) {
      // candidate may be a PR, deleted issue, or cross-repo ref — skip it.
    }
  }
  // #3826 Gap B: compute the verified-plan-rating fact (I/O here keeps the gate pure).
  const planRating = hasVerifiedPlanRatingReceipt(epicNumber, comments, { ledger, ledgerPath });
  const result = phase0GreenComplete({ labels, comments, children, planRating });
  return { epicNumber, children, ...result };
}

module.exports = {
  resolve, parseRefs, collectCandidateRefs, childBackrefsEpic, hasPhaseGateLabel,
  parsePlanRating, hasVerifiedPlanRatingReceipt,
};
