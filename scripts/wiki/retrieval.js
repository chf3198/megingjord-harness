// scripts/wiki/retrieval.js — local hybrid retrieval + chunking.
'use strict';

const fs = require('node:fs');
const { listPages, parseFrontmatter } = require('./wiki-io');
const { listMirrorWorkLogPages } = require('./mirror-source');

const RRF_K = 60;
const TOP_N = 5;
const PARENT_CONTEXT_LINES = 8;
const TITLE_BOOST = 2.0;

function tokenize(s) {
  return String(s || '').toLowerCase().match(/[a-z0-9]{2,}/g) || [];
}
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
function titleScore(qTokens, title) {
  const t = tokenize(title);
  if (t.length === 0) return 0;
  const q = new Set(qTokens);
  const hits = t.filter(tok => q.has(tok)).length;
  return hits / t.length;
}
function denseScore(qTokens, doc) {
  const docSet = new Set(tokenize(doc));
  const qSet = new Set(qTokens);
  const inter = [...qSet].filter(t => docSet.has(t)).length;
  if (qSet.size === 0 || docSet.size === 0) return 0;
  return inter / Math.sqrt(qSet.size * docSet.size);
}
function metaBoost(qTokens, slug, title) {
  const q = new Set(qTokens);
  const meta = new Set([...tokenize(slug), ...tokenize(title)]);
  const hits = [...q].filter(t => meta.has(t)).length;
  return hits === 0 ? 0 : 0.08 * hits;
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
// #3779: the retrieval read surface. Prefer FRESH work-log mirrors from the wiki-mirror branch (the reconcile
// #3729 lands there; main's copy is frozen); gracefully fall back to local work-log when wiki-mirror is
// unavailable (Tier-0 air-gapped / fresh clone). Wisdom + code pages are always read from the local tree.
function loadRetrievalPages() {
  const local = listPages();
  const mirrorWorkLog = listMirrorWorkLogPages();
  if (!mirrorWorkLog) return local; // graceful fallback
  const nonWorkLog = local.filter((page) => page.type !== 'ticket' && page.type !== 'pr');
  return nonWorkLog.concat(mirrorWorkLog);
}

function hybridSearch(query, pages = null) {
  pages = pages || loadRetrievalPages();
  const qTokens = tokenize(query);
  if (qTokens.length === 0) return [];
  const docs = pages.map(p => {
    const raw = fs.readFileSync(p.path, 'utf-8');
    const { frontmatter, body } = parseFrontmatter(raw);
    const title = frontmatter.title || p.slug;
    return { ...p, body, title, text: `${title}\n${body}` };
  });
  const avgLen = docs.reduce((a, d) => a + tokenize(d.text).length, 0) / Math.max(1, docs.length);
  const bmRank = [...docs].map(d => ({ slug: d.slug,
    score: bm25Score(qTokens, d.text, avgLen) + TITLE_BOOST * titleScore(qTokens, d.title) }))
    .sort((a, b) => b.score - a.score).map(d => d.slug);
  const dnRank = [...docs].map(d => ({ slug: d.slug, score: denseScore(qTokens, d.text) }))
    .sort((a, b) => b.score - a.score).map(d => d.slug);
  const fused = rrf([bmRank, dnRank]);
  const ranked = docs
    .map(d => ({ ...d, score: (fused[d.slug] || 0) + metaBoost(qTokens, d.slug, d.title) }))
    .filter(d => d.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, TOP_N);
  return ranked.map(d => ({ slug: d.slug, path: d.path, type: d.type, score: d.score,
    parentChunks: chunkPage(d.body).slice(0, 3) }));
}

module.exports = { hybridSearch, loadRetrievalPages, chunkPage, tokenize, bm25Score, denseScore, rrf,
  titleScore, RRF_K, TOP_N, PARENT_CONTEXT_LINES, TITLE_BOOST };
