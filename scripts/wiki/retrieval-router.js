#!/usr/bin/env node
// scripts/wiki/retrieval-router.js — Retrieval router with content-hash +
// trust_attestation verification at retrieval-time. Refs #2057
'use strict';

const fs = require('fs');
const path = require('path');
const { listPages, parseFrontmatter } = require('./wiki-io');
const verifyMod = require('./retrieval-verify');
const rankMod = require('./retrieval-rank');
const { verifyPage } = verifyMod;
const { tokenize, bm25Score, denseScore, rrfFuse } = rankMod;

const QUERY_CLASS_ROUTES = {
  factual: ['code'],
  historical: ['work-log'],
  synthesis: ['wisdom-global', 'wisdom-project'],
  'how-to': ['wisdom-project', 'wisdom-global'],
};

const VALID_QUERY_CLASSES = Object.keys(QUERY_CLASS_ROUTES);

const WIKI_TYPE_DIRS = {
  code: ['code'],
  'work-log': ['work-log/tickets', 'work-log/prs'],
  'wisdom-global': [
    'wisdom/global/concepts', 'wisdom/global/entities',
    'wisdom/global/syntheses', 'wisdom/global/skills', 'wisdom/global/sources',
  ],
  'wisdom-project': ['wisdom/project'],
};

const TOP_N = 5;

function resolveWikiType(pagePath, wikiRoot) {
  const rel = path.relative(wikiRoot, pagePath).replace(/\\/g, '/');
  for (const [wikiType, dirs] of Object.entries(WIKI_TYPE_DIRS)) {
    if (dirs.some((dir) => rel === dir || rel.startsWith(dir + '/'))) {
      return wikiType;
    }
  }
  return null;
}

function validateRouteInputs(opts) {
  if (!VALID_QUERY_CLASSES.includes(opts.queryClass)) {
    throw new Error(
      `Unknown queryClass "${opts.queryClass}". Valid: ${VALID_QUERY_CLASSES.join(', ')}`,
    );
  }
  if (!opts.query || typeof opts.query !== 'string' || opts.query.trim().length === 0) {
    throw new Error('query must be a non-empty string');
  }
}

function collectCandidates(wikiDir, targetTypes) {
  const allPages = listPages(wikiDir, { allowExternalWikiDir: true });
  return allPages
    .map((pg) => ({ ...pg, wikiType: resolveWikiType(pg.path, wikiDir) }))
    .filter((pg) => pg.wikiType && targetTypes.includes(pg.wikiType));
}

function buildDocs(candidates) {
  return candidates.map((pg) => {
    const raw = fs.readFileSync(pg.path, 'utf-8');
    const { frontmatter, body } = parseFrontmatter(raw);
    const titleStr = frontmatter.title || pg.slug;
    return { ...pg, frontmatter, body, text: `${titleStr}\n${body}` };
  });
}

function rankDocs(docs, queryTokens, maxResults) {
  const avgLen = docs.reduce((sum, doc) => sum + tokenize(doc.text).length, 0)
    / Math.max(1, docs.length);
  const bm25Ranking = [...docs]
    .map((doc) => ({ slug: doc.slug, score: bm25Score(queryTokens, doc.text, avgLen) }))
    .sort((a, b) => b.score - a.score).map((doc) => doc.slug);
  const denseRanking = [...docs]
    .map((doc) => ({ slug: doc.slug, score: denseScore(queryTokens, doc.text) }))
    .sort((a, b) => b.score - a.score).map((doc) => doc.slug);
  const fused = rrfFuse([bm25Ranking, denseRanking]);
  return docs
    .map((doc) => ({ ...doc, fusedScore: fused[doc.slug] || 0 }))
    .filter((doc) => doc.fusedScore > 0)
    .sort((a, b) => b.fusedScore - a.fusedScore)
    .slice(0, maxResults);
}

function route(opts) {
  validateRouteInputs(opts);
  const wikiDir = opts.wikiDir || path.join(__dirname, '../../wiki');
  const repoRoot = opts.repoRoot || path.join(__dirname, '../..');
  const maxResults = opts.topN || TOP_N;
  const targetTypes = QUERY_CLASS_ROUTES[opts.queryClass];
  const candidates = collectCandidates(wikiDir, targetTypes);
  if (candidates.length === 0) {
    return { queryClass: opts.queryClass, targetWikiTypes: targetTypes, results: [],
      fallback_chain: ['no-candidates'],
      telemetry: { candidate_count: 0, filtered_count: 0 } };
  }
  const docs = buildDocs(candidates);
  const ranked = rankDocs(docs, tokenize(opts.query), maxResults);
  const results = ranked.map((doc) => ({
    slug: doc.slug, path: doc.path, wikiType: doc.wikiType, score: doc.fusedScore,
    trust_verification: verifyPage(
      { frontmatter: doc.frontmatter, body: doc.body, path: doc.path }, repoRoot,
    ),
    frontmatter: doc.frontmatter,
  }));
  const fallbackChain = results.some((r) => !r.trust_verification.overall)
    ? ['stale-hash-mismatch-warning'] : [];
  return { queryClass: opts.queryClass, targetWikiTypes: targetTypes, results,
    fallback_chain: fallbackChain,
    telemetry: { candidate_count: candidates.length, filtered_count: ranked.length } };
}

module.exports = {
  route, resolveWikiType, validateRouteInputs, collectCandidates, buildDocs, rankDocs,
  QUERY_CLASS_ROUTES, VALID_QUERY_CLASSES, WIKI_TYPE_DIRS, TOP_N,
  ...verifyMod, ...rankMod,
};
