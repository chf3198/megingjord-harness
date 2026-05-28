// scripts/wiki/replay-eval-harness.js — Replay-eval harness with SHA-256-over-triple
// integrity + per-retrieval audit log. (#2059, Epic #1942 Phase-1 C9)
// Stubs auto-update pipeline if #2055 not yet merged.
'use strict';

const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');

const FIXTURES_DIR = path.resolve(__dirname, '../../tests/fixtures/replay-eval');
const AUDIT_LOG_FILE = path.resolve(__dirname, '../../logs/replay-eval-audit.jsonl');
const SIGNER = 'Orla Harper';

// --- Pipeline stub (replaced when #2055 merges) ---
function defaultPipeline(diff) { // eslint-disable-line no-unused-vars
  return { wiki_delta: [] };
}

function resolvePipeline() {
  try {
    return require('./auto-update-pipeline');
  } catch (_err) {
    return { run: defaultPipeline };
  }
}

// --- SHA-256-over-triple integrity ---
function tripleHash(inputDiff, expectedDelta, actualDelta) {
  const tripleText = JSON.stringify({ inputDiff, expectedDelta, actualDelta });
  return crypto.createHash('sha256').update(tripleText).digest('hex');
}

// --- Audit log emission ---
function emitAuditEntry(entry) {
  fs.mkdirSync(path.dirname(AUDIT_LOG_FILE), { recursive: true });
  fs.appendFileSync(AUDIT_LOG_FILE, JSON.stringify(entry) + '\n');
}

function buildAuditEntry(fixtureId, inputDiff, expectedDelta, actualDelta, integrityHash) {
  return {
    ts: new Date().toISOString(),
    fixture_id: fixtureId,
    query_hash: crypto.createHash('sha256').update(inputDiff).digest('hex').slice(0, 16),
    result_hash: integrityHash,
    signer: SIGNER,
    expected_count: expectedDelta.length,
    actual_count: actualDelta.length,
  };
}

// --- Precision / recall helpers ---
function computeSlugSet(delta) {
  return new Set((delta || []).map(entry => entry.slug));
}

function precisionRecall(expectedDelta, actualDelta) {
  const expectedSlugs = computeSlugSet(expectedDelta);
  const actualSlugs = computeSlugSet(actualDelta);
  if (actualSlugs.size === 0 && expectedSlugs.size === 0) {
    return { precision: 1, recall: 1 };
  }
  const truePositives = [...actualSlugs].filter(slug => expectedSlugs.has(slug)).length;
  const precision = actualSlugs.size === 0 ? 0 : truePositives / actualSlugs.size;
  const recall = expectedSlugs.size === 0 ? 1 : truePositives / expectedSlugs.size;
  return { precision, recall };
}

// --- Fixture loading ---
function loadFixtures(fixturesDir) {
  if (!fs.existsSync(fixturesDir)) return [];
  return fs.readdirSync(fixturesDir)
    .filter(file => file.endsWith('.json'))
    .sort()
    .map(file => JSON.parse(fs.readFileSync(path.join(fixturesDir, file), 'utf-8')));
}

// --- Single fixture evaluation ---
function evalFixture(fixture, pipeline) {
  const result = pipeline.run ? pipeline.run(fixture.pr_diff) : pipeline(fixture.pr_diff);
  const actualDelta = (result && result.wiki_delta) ? result.wiki_delta : [];
  const integrityHash = tripleHash(fixture.pr_diff, fixture.expected_wiki_delta, actualDelta);
  const auditEntry = buildAuditEntry(
    fixture.id, fixture.pr_diff, fixture.expected_wiki_delta, actualDelta, integrityHash
  );
  emitAuditEntry(auditEntry);
  const { precision, recall } = precisionRecall(fixture.expected_wiki_delta, actualDelta);
  return { id: fixture.id, precision, recall, integrityHash, auditEntry };
}

// --- Aggregate report ---
function aggregateResults(results) {
  const count = results.length;
  if (count === 0) return { ok: false, reason: 'no-fixtures', count: 0 };
  const meanPrecision = results.reduce((acc, r) => acc + r.precision, 0) / count;
  const meanRecall = results.reduce((acc, r) => acc + r.recall, 0) / count;
  return {
    ok: true,
    count,
    mean_precision: +meanPrecision.toFixed(3),
    mean_recall: +meanRecall.toFixed(3),
    results,
  };
}

// --- Main entry ---
function runReplayEval(opts = {}) {
  const pipeline = opts.pipeline || resolvePipeline();
  const fixtures = opts.fixtures || loadFixtures(opts.fixturesDir || FIXTURES_DIR);
  if (fixtures.length === 0) return { ok: false, reason: 'no-fixtures', count: 0 };
  const results = fixtures.map(fixture => evalFixture(fixture, pipeline));
  return aggregateResults(results);
}

if (require.main === module) {
  const report = runReplayEval();
  console.log(JSON.stringify({
    ok: report.ok,
    count: report.count,
    mean_precision: report.mean_precision,
    mean_recall: report.mean_recall,
  }, null, 2));
}

module.exports = {
  runReplayEval, evalFixture, aggregateResults, loadFixtures,
  precisionRecall, tripleHash, emitAuditEntry, buildAuditEntry,
  FIXTURES_DIR, AUDIT_LOG_FILE, SIGNER,
};
