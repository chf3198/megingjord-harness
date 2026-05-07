// scripts/wiki/retrieval.js — Hybrid retrieval (#868) + chunking (#869).
// Implements: BM25 lexical + cosine-style overlap dense + RRF fusion.
// Local-only computation; no LLM/embedding calls (uses term-frequency proxy).
'use strict';

const fs = require('node:fs');
const path = require('node:path');
const { listPages, WIKI_DIR } = require('./wiki-io');

const RRF_K = 60;
const TOP_N = 5;
const PARENT_CONTEXT_LINES = 8;

function tokenize(s) {
  return String(s || '').toLowerCase().match(/[a-z0-9]{2,}/g) || [];
}

/** #869 — sentence-boundary chunks; returns small chunks + parent ranges.
 * @param {string} text - Page body.
 * @returns {Array<{chunk: string, parentStart: number, parentEnd: number}>}
 */
function chunkPage(text) {
  const lines = text.split('\n');
  const sentences = [];
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;
    const parts = line.split(/(?<=[.!?])\s+/);
    for (const part of parts) {
      if (part.length >= 8) sentences.push({ chunk: part, idx: i });
    }
  }
  return sentences.map(s => ({ chunk: s.chunk, parentStart: Math.max(0, s.idx - PARENT_CONTEXT_LINES),
    parentEnd: Math.min(lines.length, s.idx + PARENT_CONTEXT_LINES) }));
}

function bm25Score(qTokens, doc, avgLen) {
  const k1 = 1.5, b = 0.75;
  const docTokens = tokenize(doc);
  const docLen = docTokens.length || 1;
  const tf = {};
  for (const t of docTokens) tf[t] = (tf[t] || 0) + 1;
  let score = 0;
  for (const q of qTokens) {
    const f = tf[q] || 0;
    if (f === 0) continue;
    score += (f * (k1 + 1)) / (f + k1 * (1 - b + b * docLen / avgLen));
  }
  return score;
}

function denseScore(qTokens, doc) {
  const docSet = new Set(tokenize(doc));
  const qSet = new Set(qTokens);
  const inter = [...qSet].filter(t => docSet.has(t)).length;
  if (qSet.size === 0 || docSet.size === 0) return 0;
  return inter / Math.sqrt(qSet.size * docSet.size);
}

function rrf(rankings) {
  const scores = {};
  for (const ranking of rankings) {
    ranking.forEach((id, rank) => {
      scores[id] = (scores[id] || 0) + 1 / (RRF_K + rank);
    });
  }
  return scores;
}

/** Hybrid retrieval: BM25 + dense + RRF fusion.
 * @param {string} query - User query.
 * @param {Array<{slug, path, type}>} pages - Optional override; defaults to listPages().
 * @returns {Array<{slug, path, type, score, parentChunks}>}
 */
function hybridSearch(query, pages = null) {
  pages = pages || listPages();
  const qTokens = tokenize(query);
  if (qTokens.length === 0) return [];
  const docs = pages.map(p => ({ ...p, body: fs.readFileSync(p.path, 'utf-8') }));
  const avgLen = docs.reduce((a, d) => a + tokenize(d.body).length, 0) / Math.max(1, docs.length);
  const bmRank = [...docs].map(d => ({ slug: d.slug, score: bm25Score(qTokens, d.body, avgLen) }))
    .sort((a, b) => b.score - a.score).map(d => d.slug);
  const dnRank = [...docs].map(d => ({ slug: d.slug, score: denseScore(qTokens, d.body) }))
    .sort((a, b) => b.score - a.score).map(d => d.slug);
  const fused = rrf([bmRank, dnRank]);
  const ranked = docs
    .map(d => ({ ...d, score: fused[d.slug] || 0 }))
    .filter(d => d.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, TOP_N);
  return ranked.map(d => ({ slug: d.slug, path: d.path, type: d.type, score: d.score,
    parentChunks: chunkPage(d.body).slice(0, 3) }));
}

module.exports = { hybridSearch, chunkPage, tokenize, bm25Score, denseScore, rrf,
  RRF_K, TOP_N, PARENT_CONTEXT_LINES };
