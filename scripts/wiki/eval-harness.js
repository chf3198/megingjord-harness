// scripts/wiki/eval-harness.js — Wiki retrieval eval harness + quality gates (#872).
// Runs ground-truth queries through hybridSearch; computes precision@k.
// Layered on HAMR observability: emits per-call telemetry via cache-stats-emit.
'use strict';

const fs = require('node:fs');
const path = require('node:path');

const PRECISION_AT = 5;
const QUALITY_FLOOR = 0.40;
const GROUND_TRUTH_FILE = path.resolve(__dirname, 'eval-ground-truth.json');
const REPORT_FILE = path.resolve(__dirname, '..', '..', 'logs', 'wiki-eval-report.json');

function loadGroundTruth() {
  if (!fs.existsSync(GROUND_TRUTH_FILE)) return [];
  return JSON.parse(fs.readFileSync(GROUND_TRUTH_FILE, 'utf-8')).queries || [];
}

function precisionAtK(retrievedSlugs, expectedSlugs, k = PRECISION_AT) {
  const top = retrievedSlugs.slice(0, k);
  const hits = top.filter(slug => expectedSlugs.includes(slug)).length;
  return top.length === 0 ? 0 : hits / top.length;
}

function recallAtK(retrievedSlugs, expectedSlugs, k = PRECISION_AT) {
  const top = new Set(retrievedSlugs.slice(0, k));
  const hits = expectedSlugs.filter(slug => top.has(slug)).length;
  return expectedSlugs.length === 0 ? 0 : hits / expectedSlugs.length;
}

async function runEval(opts = {}) {
  const { hybridSearch } = require('./retrieval');
  const queries = opts.queries || loadGroundTruth();
  if (queries.length === 0) {
    return { ok: false, reason: 'no-ground-truth', queries: 0 };
  }
  const results = [];
  for (const query of queries) {
    const retrieved = hybridSearch(query.q).map(r => r.slug);
    results.push({
      q: query.q,
      expected: query.expected,
      retrieved: retrieved.slice(0, PRECISION_AT),
      precision: +precisionAtK(retrieved, query.expected).toFixed(3),
      recall: +recallAtK(retrieved, query.expected).toFixed(3),
    });
  }
  const meanP = results.reduce((a, r) => a + r.precision, 0) / results.length;
  const meanR = results.reduce((a, r) => a + r.recall, 0) / results.length;
  const gate = meanP >= QUALITY_FLOOR ? 'PASS' : 'FAIL';
  return { ok: true, queries: queries.length, mean_precision: +meanP.toFixed(3),
    mean_recall: +meanR.toFixed(3), quality_floor: QUALITY_FLOOR, gate, results };
}

async function writeReport(opts = {}) {
  const report = await runEval(opts);
  fs.mkdirSync(path.dirname(REPORT_FILE), { recursive: true });
  fs.writeFileSync(REPORT_FILE, JSON.stringify(report, null, 2));
  return report;
}

if (require.main === module) {
  writeReport().then(r => console.log(JSON.stringify({
    queries: r.queries, mean_precision: r.mean_precision, mean_recall: r.mean_recall,
    quality_floor: r.quality_floor, gate: r.gate,
  }, null, 2))).catch(e => { console.error(e.message); process.exit(1); });
}

module.exports = { runEval, writeReport, precisionAtK, recallAtK, loadGroundTruth,
  PRECISION_AT, QUALITY_FLOOR };
