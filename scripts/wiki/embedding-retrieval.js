#!/usr/bin/env node
'use strict';
// #3762 (Epic #3719): OPTIONAL local/free embedding acceleration over the mandatory lexical floor.
// Behind the WIKI_EMBEDDINGS_ENABLED flag (default OFF → lexical is the default + air-gapped path).
// Uses the existing local-Ollama embedder primitive (fleet-rag-embedder#defaultEmbedder, loopback,
// zero-cost); when the flag is off OR the embedder is unreachable (returns null), it DEGRADES
// GRACEFULLY to the shipped lexical hybridSearch. Promotion (advisory→default) is gated on a
// precision/recall replay-eval vs the lexical baseline — NOT a calendar (#1617/#1771). No hosted
// or paid vector DB (G3/G5).
const path = require('path');
const fs = require('fs');
const { hybridSearch } = require('./retrieval');
const { precisionAtK, recallAtK, loadGroundTruth } = require('./eval-harness');
const { defaultEmbedder } = require('../global/fleet-rag-embedder');

const CORPUS_PATH = path.resolve(__dirname, 'eval-ground-truth.json');
const DEFAULT_TOP_N = 5;
const PAGE_EMBED_CHARS = 2000; // cap the page text fed to the embedder (G6: bounded work)

function embeddingsEnabled() {
  return process.env.WIKI_EMBEDDINGS_ENABLED === '1';
}

function qualityFloor() {
  try { return require(CORPUS_PATH).quality_floor ?? 0.4; } catch { return 0.4; }
}

function cosineSim(a, b) {
  if (!Array.isArray(a) || !Array.isArray(b) || a.length !== b.length || a.length === 0) return 0;
  let dot = 0; let na = 0; let nb = 0;
  for (let i = 0; i < a.length; i += 1) { dot += a[i] * b[i]; na += a[i] * a[i]; nb += b[i] * b[i]; }
  return (na === 0 || nb === 0) ? 0 : dot / (Math.sqrt(na) * Math.sqrt(nb));
}

function lexical(query, pages) {
  return hybridSearch(query, pages).map((r) => (typeof r === 'string' ? r : r.slug));
}

function pageText(page) {
  try {
    const raw = fs.readFileSync(page.path, 'utf-8');
    return raw.replace(/^---\n[\s\S]*?\n---\n?/, '').slice(0, PAGE_EMBED_CHARS);
  } catch { return page.slug || ''; }
}

/**
 * Embedding-ranked retrieval with graceful lexical fallback.
 * @param {string} query
 * @param {Array} pages - candidate pages ({slug, path})
 * @param {{embedder?:Function, topN?:number, force?:boolean}} [opts]
 * @returns {Promise<{mode:string, results:string[]}>} mode: embedding | lexical-fallback | flag-off
 */
async function embeddingSearch(query, pages, opts = {}) {
  const topN = opts.topN || DEFAULT_TOP_N;
  if (!opts.force && !embeddingsEnabled()) return { mode: 'flag-off', results: lexical(query, pages).slice(0, topN) };
  const embedder = opts.embedder || defaultEmbedder;
  const qVec = await embedder(query);
  if (!Array.isArray(qVec) || qVec.length === 0) { // embedder absent/failed → graceful lexical
    return { mode: 'lexical-fallback', results: lexical(query, pages).slice(0, topN) };
  }
  const scored = [];
  for (const page of pages) {
    const vec = await embedder(pageText(page));
    scored.push({ slug: page.slug, score: Array.isArray(vec) ? cosineSim(qVec, vec) : -1 });
  }
  const ranked = scored.sort((a, b) => b.score - a.score).map((s) => s.slug).slice(0, topN);
  return { mode: 'embedding', results: ranked };
}

// Replay-eval a searcher (slug-returning fn) over the labeled corpus → mean precision/recall.
async function runRetrievalEval(searchFn, queries) {
  const qs = queries || loadGroundTruth();
  const rows = [];
  for (const query of qs) {
    const retrieved = await searchFn(query.q);
    rows.push({ precision: precisionAtK(retrieved, query.expected), recall: recallAtK(retrieved, query.expected) });
  }
  const mean = (key) => rows.reduce((a, r) => a + r[key], 0) / Math.max(1, rows.length);
  return { queries: rows.length, mean_precision: +mean('precision').toFixed(3), mean_recall: +mean('recall').toFixed(3) };
}

// Promotion is eligible ONLY when embedding retrieval beats the lexical baseline AND clears the
// quality floor — a replay-eval gate, never a calendar. Advisory until an embedder is present.
function promotionEligibility(evalEmbedding, evalLexical, floor = qualityFloor()) {
  const embP = evalEmbedding.mean_precision;
  const lexP = evalLexical.mean_precision;
  return {
    promotionEligible: embP >= lexP && embP >= floor,
    embedding_precision: embP, lexical_precision: lexP, quality_floor: floor,
    disposition: 'ship advisory; promotion deferred (replay-eval-gated, not calendar)',
  };
}

module.exports = {
  embeddingsEnabled, cosineSim, embeddingSearch, runRetrievalEval, promotionEligibility,
  qualityFloor, lexical, DEFAULT_TOP_N,
};

if (require.main === module) {
  const cliQuery = process.argv[2] || 'HAMR cache adapters';
  const { loadRetrievalPages } = require('./retrieval');
  embeddingSearch(cliQuery, loadRetrievalPages(), { force: process.argv.includes('--force') })
    .then((r) => { process.stdout.write(JSON.stringify(r, null, 2) + '\n'); process.exit(0); })
    .catch((e) => { console.error(e.message); process.exit(2); });
}
