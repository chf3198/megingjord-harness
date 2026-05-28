#!/usr/bin/env node
// scripts/wiki/retrieval-rank.js — BM25 + dense + RRF fusion ranking helpers.
// Extracted from retrieval-router.js per readability gate. Refs #2057
'use strict';

const RRF_K = 60;

function tokenize(str) {
  return String(str || '').toLowerCase().match(/[a-z0-9]{2,}/g) || [];
}

function bm25Score(queryTokens, docText, avgLen) {
  const K1 = 1.5;
  const BM25_B = 0.75;
  const docTokens = tokenize(docText);
  const docLen = docTokens.length || 1;
  const tf = {};
  for (const tok of docTokens) tf[tok] = (tf[tok] || 0) + 1;
  let score = 0;
  for (const qt of queryTokens) {
    const freq = tf[qt] || 0;
    if (freq === 0) continue;
    score += (freq * (K1 + 1)) / (freq + K1 * (1 - BM25_B + BM25_B * docLen / avgLen));
  }
  return score;
}

function denseScore(queryTokens, docText) {
  const docSet = new Set(tokenize(docText));
  const qSet = new Set(queryTokens);
  const intersect = [...qSet].filter((tok) => docSet.has(tok)).length;
  if (qSet.size === 0 || docSet.size === 0) return 0;
  return intersect / Math.sqrt(qSet.size * docSet.size);
}

function rrfFuse(rankings) {
  const scores = {};
  for (const ranking of rankings) {
    ranking.forEach((docId, rank) => {
      scores[docId] = (scores[docId] || 0) + 1 / (RRF_K + rank);
    });
  }
  return scores;
}

// ---- Wiki-type resolution ----------------------------------------------------

/**
 * Determine the wiki type of a page from its path relative to wikiRoot.
 * @param {string} pagePath - absolute path to .md file
 * @param {string} wikiRoot - absolute path to wiki/ directory
 * @returns {string|null} wiki type key, or null if unrecognised
 */
module.exports = { tokenize, bm25Score, denseScore, rrfFuse, RRF_K };
