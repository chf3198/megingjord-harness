#!/usr/bin/env node
'use strict';
// stuck-state-replay-eval.js — #3748. Calibrates the stuck-state-detector (#3748) against a LABELED
// corpus to gate its advisory→blocking promotion (replay-eval over calendar, per #1771/#1827) and to
// bound the false-positive rate. Pure functions of their inputs; the CLI is a thin wrapper.
const fs = require('node:fs');
const path = require('node:path');
const { detectStuckState } = require('./stuck-state-detector');

// The detector may flip advisory→blocking only when precision against the corpus reaches this floor.
const PROMOTION_PRECISION = 0.85;
const DEFAULT_CORPUS = path.join(__dirname, '..', '..', 'tests', 'fixtures', 'stuck-state-corpus.json');

// Score the detector over a corpus. Positive = detector fires (stuck===true); label 'stuck' = should fire.
function scoreCorpus(samples, opts = {}) {
  let tp = 0, fp = 0, fn = 0, tn = 0;
  for (const s of samples || []) {
    const fired = detectStuckState(s.signals || {}, opts).stuck;
    const should = s.label === 'stuck';
    if (fired && should) tp += 1;
    else if (fired && !should) fp += 1;
    else if (!fired && should) fn += 1;
    else tn += 1;
  }
  const precision = tp + fp ? tp / (tp + fp) : 1;
  const recall = tp + fn ? tp / (tp + fn) : 1;
  const falsePositiveRate = fp + tn ? fp / (fp + tn) : 0;
  return {
    total: (samples || []).length, tp, fp, fn, tn,
    precision, recall, falsePositiveRate,
    promotionEligible: precision >= PROMOTION_PRECISION,
  };
}

function loadCorpus(file) {
  const parsed = JSON.parse(fs.readFileSync(file || DEFAULT_CORPUS, 'utf8'));
  return Array.isArray(parsed) ? parsed : parsed.samples || [];
}

module.exports = { scoreCorpus, loadCorpus, PROMOTION_PRECISION, DEFAULT_CORPUS };

if (require.main === module) {
  const file = process.argv.includes('--corpus') ? process.argv[process.argv.indexOf('--corpus') + 1] : DEFAULT_CORPUS;
  const result = scoreCorpus(loadCorpus(file));
  process.stdout.write(JSON.stringify(result, null, 2) + '\n');
  process.exit(result.promotionEligible ? 0 : 2);
}
