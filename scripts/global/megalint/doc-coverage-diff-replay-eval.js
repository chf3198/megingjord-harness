'use strict';
// Refs #3122 (Epic #2707) — replay-eval calibration gating the doc-coverage
// diff-membership advisory→blocking promotion. Mirrors the test-floor replay-eval
// model (#3105/#3068): the `doc-coverage-updated-not-in-diff` check may flip from
// advisory to blocking ONLY when its precision over a LABELED corpus reaches the
// floor; below it (or via the env kill-switch) it auto-reverts to advisory.
// Replay-eval-gated, never calendar-gated (#1771/#1827).

const fs = require('fs');
const path = require('path');
const { verifyDeclaredSurfaces } = require('./doc-coverage-diff-verify');

// Promotion threshold: blocking only at precision ≥ this floor against the corpus.
const PROMOTION_PRECISION = 0.85;
const DEFAULT_CORPUS = path.join(__dirname, '..', '..', '..', 'tests', 'fixtures', 'doc-coverage-diff-corpus.json');
// G6 rollback: force advisory regardless of corpus precision.
const DISABLE_ENV = 'DOC_COVERAGE_DIFF_BLOCKING_DISABLED';

// "Positive" = the diff-membership check flags a violation: a surface declared
// UPDATED/DONE that no changed file in the diff covers.
function flagsViolation(declared, changedFiles) {
  // Defensive: a malformed corpus row must degrade, never throw (G6).
  const surfaces = (Array.isArray(declared) ? declared : []).filter((s) => typeof s === 'string');
  const files = (Array.isArray(changedFiles) ? changedFiles : []).filter((f) => typeof f === 'string');
  const result = verifyDeclaredSurfaces(surfaces, null, { changedFiles: files, structural: false });
  return result.violations.length > 0;
}

/**
 * Replay the diff-membership check over a labeled corpus and score precision/recall.
 * Each item: { declared: string[], paths: string[], expectedInDiff: boolean }.
 * expectedInDiff === false means the declared surface SHOULD be flagged (a true gap).
 * @returns {{n,truePos,falsePos,trueNeg,falseNeg,precision,recall,promotionEligible}}
 */
function replayEval(corpus) {
  const c = { truePos: 0, falsePos: 0, trueNeg: 0, falseNeg: 0 };
  for (const raw of corpus || []) {
    const item = raw || {};
    const predictedGap = flagsViolation(item.declared, item.paths);
    const actualGap = item.expectedInDiff === false;
    if (predictedGap && actualGap) c.truePos += 1;
    else if (predictedGap && !actualGap) c.falsePos += 1;
    else if (!predictedGap && !actualGap) c.trueNeg += 1;
    else c.falseNeg += 1;
  }
  const precisionDenom = c.truePos + c.falsePos;
  const recallDenom = c.truePos + c.falseNeg;
  const precision = precisionDenom ? c.truePos / precisionDenom : 1;
  const recall = recallDenom ? c.truePos / recallDenom : 1;
  return { n: (corpus || []).length, ...c,
    precision: Number(precision.toFixed(4)), recall: Number(recall.toFixed(4)),
    promotionEligible: precision >= PROMOTION_PRECISION };
}

function loadCorpus(file = DEFAULT_CORPUS) { return JSON.parse(fs.readFileSync(file, 'utf8')); }

// Live promotion decision consumed by the doc-coverage gate. Computed from the
// committed corpus each process (so it AUTO-REVOKES the instant corpus precision
// regresses below the floor); env kill-switch forces advisory; missing/unreadable
// corpus fails SAFE to advisory.
let _cache;
function isBlockingPromoted(opts = {}) {
  if (process.env[DISABLE_ENV] === '1') return false;
  if (opts.corpus) return replayEval(opts.corpus).promotionEligible;
  if (_cache === undefined) {
    try { _cache = replayEval(loadCorpus(opts.corpusFile)).promotionEligible; }
    catch (_) { _cache = false; }
  }
  return _cache;
}

// Severity the doc-coverage gate should attach to a diff-membership violation.
function diffSeverity(opts = {}) { return isBlockingPromoted(opts) ? 'error' : 'advisory'; }

// Test seam: drop the cached promotion decision so a fresh env/corpus is re-read.
function _resetCache() { _cache = undefined; }

function runCli(argv) {
  const file = (argv.find((a) => a.startsWith('--corpus=')) || '').split('=')[1] || DEFAULT_CORPUS;
  const result = replayEval(loadCorpus(file));
  if (argv.includes('--json')) { process.stdout.write(JSON.stringify(result, null, 2) + '\n'); return 0; }
  process.stdout.write(`doc-coverage diff replay-eval over ${result.n} cases: precision=${result.precision} recall=${result.recall}\n`);
  process.stdout.write(result.promotionEligible
    ? `✓ promotion-eligible (precision >= ${PROMOTION_PRECISION}) — diff-membership check BLOCKS\n`
    : `⚠ not promotion-eligible (precision < ${PROMOTION_PRECISION}) — stays advisory\n`);
  return 0;
}

if (require.main === module) { process.exit(runCli(process.argv.slice(2))); }

module.exports = { PROMOTION_PRECISION, DEFAULT_CORPUS, DISABLE_ENV, flagsViolation,
  replayEval, loadCorpus, isBlockingPromoted, diffSeverity, runCli, _resetCache };
