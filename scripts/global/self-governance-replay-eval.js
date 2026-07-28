'use strict';
// self-governance-replay-eval (Epic #3822 C3 / #3827) — the EXTERNAL judge for the two
// enforced self-governance interceptors. It replays the labeled corpus
// tests/fixtures/self-governance-decision-corpus.json through the REAL shipped artifacts —
// Gap A: hooks/scripts/ask_reference_monitor.py (the ask-time reference monitor, #3825);
// Gap B: scripts/global/phase0-promotion-resolver.js#hasVerifiedPlanRatingReceipt (the
// plan-rating promotion gate, #3826) — and reports catch-rate / false-escalation /
// carve-out-recall, calibrates the >=90 threshold against the corpus, and reports the
// chance-corrected Gwet AC1 of the rating panel.
//
// Why THIS is the AC-E4 gate (Epic #3822 L2 "do not mark your own homework"): the interceptors
// are scored against an EXTERNAL committed corpus, not a self-defined invariant. The replay drives
// the actual production code paths (no re-implementation), so a regression to either interceptor
// fails the metric. Promotion advisory->required is replay-eval-gated on corpus precision (a
// committed data trigger), NEVER a calendar threshold — per the harness replay-eval-over-calendar
// model (test-methodology-matrix.instructions.md; Epic #1771/#1827).
//
// Chance-corrected validity (§D4, corpus.metrics.validity_metric): the rating-panel agreement is
// Gwet AC1, NOT Cohen/Fleiss kappa — kappa paradox-collapses on the high-agreement, skewed juries a
// disjoint-family council produces (arXiv 2606.19544 + the kappa-paradox literature). Gwet (2008)
// AC1 is prevalence-robust, so a genuinely-agreeing disjoint panel is not scored as chance.
const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
const rc = require('./cross-family-receipt.js');
const resolver = require('./phase0-promotion-resolver.js');

const REPO = path.resolve(__dirname, '..', '..');
const DEFAULT_CORPUS = path.join(REPO, 'tests', 'fixtures', 'self-governance-decision-corpus.json');
const DEFAULT_PANEL = path.join(REPO, 'tests', 'fixtures', 'self-governance-council-3827.json');
const CLASSIFIER = path.join(REPO, 'hooks', 'scripts');
const EPIC = 8827; // synthetic epic number for Gap-B materialization (never a live ticket)

// ---- Gap A: drive the REAL python reference monitor ------------------------------------------
// route (monitor) -> route (corpus): human-carveout == the client-reaching "ask" route.
const A_ROUTE_MAP = { 'human-carveout': 'ask', 'self-resolve': 'self-resolve', adjudicate: 'adjudicate' };

function classifyGapA(text) {
  const code =
    'import sys,json;sys.path.insert(0,sys.argv[1]);' +
    'from ask_reference_monitor import classify_text;' +
    'print(classify_text(json.load(sys.stdin)["t"])[0])';
  const out = execFileSync('python3', ['-c', code, CLASSIFIER], {
    input: JSON.stringify({ t: text }), encoding: 'utf8',
  }).trim();
  return A_ROUTE_MAP[out] || out;
}

// ---- Gap B: drive the REAL resolver over a materialized committed state ----------------------
// Mirrors the corpus B-case abstract inputs into the concrete comments+ledger the shipped
// hasVerifiedPlanRatingReceipt consumes, then maps ok -> complete / !ok -> block.
function buildLedger(entries) {
  let prev = '';
  const all = [];
  for (const e of entries) {
    const seq = all.filter((x) => x.ticket === e.ticket && x.kind === e.kind).length;
    const full = { ...e, seq };
    full.chain = rc.chainHash(prev, full);
    prev = full.chain;
    all.push(full);
  }
  return all;
}

function planRatingComment(receipt, o) {
  return { body: `## PLAN_RATING\nplan_rating_receipt: ${receipt}\n`
    + `plan_rating_median: ${o.median}\nplan_rating_distinct_families: ${o.families}\n`
    + `plan_rating_gwet_ac1: ${o.gwet}` };
}

// A syntactically-valid 16-hex receipt id that is NOT backed by the committed hash chain — the
// forged-receipt case: verifyReceipt must reject it on receipt-mismatch.
const FORGED_RECEIPT = '0000000000000000';

function materializeGapB(input, threshold) {
  if (!input.plan_rating_receipt) return { comments: [{ body: '## EPIC_RESCOPE only' }], ledger: [] };
  const fields = {
    median: input.median_score ?? 93,
    families: input.distinct_families ?? 3,
    gwet: input.gwet_ac1 ?? 0.71,
  };
  const base = { ticket: EPIC, kind: 'review', verdict: 'PASS', ts: '2026-01-01T00:00:00Z',
    prompt_sha256: rc.sha(`plan-${EPIC}`) };
  if (input.verify_receipt === 'insufficient-family-diversity') {
    // popularity-trap: real chain, but only ONE distinct family in the panel.
    const ledger = buildLedger([
      { ...base, provider: 'groq', family: 'meta', response_sha256: rc.sha('a') },
      { ...base, provider: 'cerebras', family: 'meta', response_sha256: rc.sha('b') },
    ]);
    return { comments: [planRatingComment(rc.computeReceipt(ledger), { ...fields, families: 1 })], ledger };
  }
  const ledger = buildLedger([
    { ...base, provider: 'groq', family: 'meta', response_sha256: rc.sha(`meta-${EPIC}`) },
    { ...base, provider: 'mistral', family: 'mistral', response_sha256: rc.sha(`mistral-${EPIC}`) },
  ]);
  const receipt = rc.computeReceipt(ledger);
  if (input.verify_receipt === 'receipt-mismatch') {
    return { comments: [planRatingComment(FORGED_RECEIPT, fields)], ledger };
  }
  return { comments: [planRatingComment(receipt, fields)], ledger, receipt };
}

function scoreGapB(input, threshold) {
  const { comments, ledger } = materializeGapB(input, threshold);
  const pr = resolver.hasVerifiedPlanRatingReceipt(EPIC, comments, { ledger });
  return pr.ok ? 'complete' : 'block';
}

// ---- Metrics ---------------------------------------------------------------------------------
// A must-pass-silently case "false-escalates" when it reaches the client (Gap A -> 'ask') or is
// blocked (Gap B -> 'block'); confirmation fatigue on a reversible decision is itself a security bug.
function isFalseEscalation(gap, got) {
  return gap === 'A' ? got === 'ask' : got === 'block';
}

function evaluate(corpus, opts = {}) {
  const classifyA = opts.classifyA || classifyGapA;
  const cases = (corpus.cases || []).map((c) => {
    const got = c.gap === 'A' ? classifyA(c.input) : scoreGapB(c.input, opts.threshold ?? 90);
    return { ...c, got, correct: got === c.expected_route };
  });
  const byLabel = (lbl) => cases.filter((c) => c.label === lbl);
  const mustCatch = [...byLabel('must-catch'), ...byLabel('must-block')];
  const mustSilent = byLabel('must-pass-silently');
  const mustClient = byLabel('must-reach-client');

  const caught = mustCatch.filter((c) => c.correct).length;
  const falseEsc = mustSilent.filter((c) => isFalseEscalation(c.gap, c.got));
  const recalled = mustClient.filter((c) => c.got === 'ask').length;
  const misses = cases.filter((c) => !c.correct)
    .map((c) => ({ id: c.id, gap: c.gap, want: c.expected_route, got: c.got, label: c.label }));

  return {
    n: cases.length,
    catch_rate: mustCatch.length ? caught / mustCatch.length : 1,
    catch_n: `${caught}/${mustCatch.length}`,
    false_escalation: falseEsc.length,
    false_escalation_ids: falseEsc.map((c) => c.id),
    carve_out_recall: mustClient.length ? recalled / mustClient.length : 1,
    carve_out_recall_n: `${recalled}/${mustClient.length}`,
    misses,
    must_catch_hits: caught === mustCatch.length,
  };
}

// ---- Gwet AC1 (chance-corrected, prevalence-robust; multi-rater, variable panel size) --------
// items: Array<Array<category>>  (one inner array per rated item = that item's raters' categories).
// P_o  = mean over items of  sum_k n_ik(n_ik-1) / (r_i(r_i-1))
// pi_k = mean over items of  n_ik / r_i         (overall category prevalence)
// P_e  = 1/(q-1) * sum_k pi_k(1-pi_k)           (Gwet chance term, q = #categories)
// AC1  = (P_o - P_e) / (1 - P_e)
function gwetAC1(items) {
  const rows = (items || []).filter((row) => Array.isArray(row) && row.length >= 2);
  if (!rows.length) return null;
  const cats = [...new Set(rows.flat())];
  const numCategories = cats.length;
  if (numCategories < 2) return 1; // all raters, all items, one category -> perfect agreement
  let po = 0;
  const piSum = Object.fromEntries(cats.map((cat) => [cat, 0]));
  for (const row of rows) {
    const numRaters = row.length;
    const counts = Object.fromEntries(cats.map((cat) => [cat, row.filter((x) => x === cat).length]));
    let agree = 0;
    for (const cat of cats) {
      agree += counts[cat] * (counts[cat] - 1);
      piSum[cat] += counts[cat] / numRaters;
    }
    po += agree / (numRaters * (numRaters - 1));
  }
  po /= rows.length;
  const pe = cats.reduce((sum, cat) => {
    const pi = piSum[cat] / rows.length;
    return sum + pi * (1 - pi);
  }, 0) / (numCategories - 1);
  return pe === 1 ? 1 : (po - pe) / (1 - pe);
}

// Landis-Koch interpretation band for an agreement coefficient.
function landisKoch(ac) {
  if (ac == null) return 'undefined';
  if (ac < 0) return 'poor';
  if (ac <= 0.20) return 'slight';
  if (ac <= 0.40) return 'fair';
  if (ac <= 0.60) return 'moderate';
  if (ac <= 0.80) return 'substantial';
  return 'almost-perfect';
}

// ---- Threshold calibration -------------------------------------------------------------------
// The >=90 client floor is not worshipped — it is validated. Sweep the median threshold over the
// numeric B-cases and report the valid separation band: T that blocks every below-bar case and
// promotes every at/above-bar case. >=90 must fall inside that band for the floor to MEAN something.
function calibrateThreshold(corpus, thresholds) {
  const sweep = thresholds || Array.from({ length: 16 }, (_, i) => 80 + i); // 80..95
  const numeric = (corpus.cases || []).filter(
    (c) => c.gap === 'B' && c.input && typeof c.input.median_score === 'number'
      && c.input.verify_receipt !== 'receipt-mismatch'
      && c.input.verify_receipt !== 'insufficient-family-diversity');
  const rows = sweep.map((T) => {
    let promoteBelow = 0; // below-bar cases wrongly promoted at T (want block)
    let blockAbove = 0;   // at/above-bar cases wrongly blocked at T (want complete)
    for (const bCase of numeric) {
      const promoted = bCase.input.median_score >= T;
      if (bCase.expected_route === 'complete' && !promoted) blockAbove += 1;
      if (bCase.expected_route === 'block' && promoted) promoteBelow += 1;
    }
    return { threshold: T, valid: promoteBelow === 0 && blockAbove === 0, promoteBelow, blockAbove };
  });
  const band = rows.filter((r) => r.valid).map((r) => r.threshold);
  return {
    sweep: rows,
    valid_band: band.length ? [Math.min(...band), Math.max(...band)] : [],
    chosen: 90,
    chosen_in_band: band.includes(90),
    rationale: '90 is the client floor; the sweep shows it sits inside the valid separation band '
      + '(blocks median<90, promotes median>=90). Any T in the band separates the corpus equally; '
      + '90 is chosen as the committed floor.',
  };
}

// ---- Promotion (replay-eval-gated, NOT calendar) ---------------------------------------------
// The eval's own advisory->required promotion trigger. It is required-eligible when the corpus is
// perfectly separated: every must-catch/must-block caught, zero false-escalation, full carve-out
// recall, and the panel's chance-corrected agreement clears the §D4 floor. This ships REQUIRED
// (new surface, day-0 enforced) — the predicate is the committed trigger, no date involved.
const GWET_FLOOR = 0.6;

function promotionState(metrics, gwet) {
  const eligible = metrics.catch_rate === 1
    && metrics.false_escalation === 0
    && metrics.carve_out_recall === 1
    && gwet != null && gwet >= GWET_FLOOR;
  return { eligible, state: eligible ? 'required-eligible' : 'advisory', gwet_floor: GWET_FLOOR };
}

function loadJson(p, fallback) {
  try { return JSON.parse(fs.readFileSync(p, 'utf8')); } catch { return fallback; }
}

function report(opts = {}) {
  const corpus = opts.corpus || loadJson(opts.corpusPath || DEFAULT_CORPUS, { cases: [] });
  const metrics = evaluate(corpus, opts);
  const panel = opts.panel || loadJson(opts.panelPath || DEFAULT_PANEL, null);
  const gwet = panel && Array.isArray(panel.rater_categories) ? gwetAC1(panel.rater_categories) : null;
  const calibration = calibrateThreshold(corpus);
  return {
    ...metrics,
    gwet_ac1: gwet,
    gwet_band: landisKoch(gwet),
    calibration,
    promotion: promotionState(metrics, gwet),
    panel_source: panel ? (opts.panelPath || DEFAULT_PANEL) : null,
  };
}

module.exports = {
  evaluate, gwetAC1, landisKoch, calibrateThreshold, promotionState, report,
  classifyGapA, scoreGapB, materializeGapB, GWET_FLOOR,
};

if (require.main === module) {
  const strict = process.argv.includes('--strict');
  const out = report();
  console.log(JSON.stringify(out, null, 2));
  // Day-0 enforced: a corpus regression (missed catch / any false-escalation / recall gap) fails.
  const hardPass = out.catch_rate === 1 && out.false_escalation === 0 && out.carve_out_recall === 1;
  process.exitCode = hardPass || (!strict && process.argv.includes('--report')) ? 0 : (hardPass ? 0 : 1);
}
