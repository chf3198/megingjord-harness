#!/usr/bin/env node
'use strict';
// #3761 (Epic #3719): wire the wiki-retrieval floor into a real baton step (the Consultant
// multi-model pre-critique) and MEASURE the token-cost reduction (G3). Grounding a critique on
// wiki knowledge without retrieval means loading the whole relevant store into context; with
// retrieval you load only the top-N relevant pages. `groundArtifact` returns the plaintext
// grounding (agent-plaintext consumption path) + the measured reduction. Reuses the shipped
// retrieval-router (#3760) over the FRESH wiki-mirror (#3779). Cross-refs #2093 (not closed).
const path = require('path');
const fs = require('fs');
const { route } = require('./retrieval-router');
const { ensureMirrorCache } = require('./mirror-source');

const DEFAULT_TOP_N = 5;
const GROUNDING_CHAR_CAP = 1200; // per-page excerpt cap in the grounding block
const QUERY_HEAD_CHARS = 400; // artifact-head window folded into the retrieval query
const QUERY_MAX_CHARS = 500; // total retrieval-query cap
const EVENTS_LOG = path.resolve(__dirname, '../../dashboard/events.jsonl');

// Harness-documented estimator convention (~4 chars/token); the reduction RATIO is
// estimator-invariant since the same estimator is applied to both baseline and retrieval.
function estimateTokens(text) {
  return Math.ceil(String(text || '').length / 4);
}

// Derive a compact retrieval query from an artifact: its first heading/title + the artifact head.
function deriveQuery(artifact) {
  const text = String(artifact || '');
  const heading = (text.match(/^#{1,3}\s+(.+)$/m) || [])[1] || '';
  const head = text.slice(0, QUERY_HEAD_CHARS).replace(/\s+/g, ' ').trim();
  return `${heading} ${head}`.trim().slice(0, QUERY_MAX_CHARS);
}

// Plaintext consumption path: read the retrieved page file at its path and strip frontmatter.
function pageBody(result) {
  try {
    const raw = fs.readFileSync(result.path, 'utf-8');
    const body = raw.replace(/^---\n[\s\S]*?\n---\n?/, '').trim();
    return body || (result.frontmatter && result.frontmatter.title) || result.slug;
  } catch {
    return (result.frontmatter && result.frontmatter.title) || result.slug || '';
  }
}

// Token-cost of grounding: baseline = load EVERY candidate page (no-retrieval naive path),
// retrieval = the top-N grounding excerpts only. Returns the grounding text + the cost record.
function measureGrounding(results, candidateCount) {
  const perPageBaseline = results.length
    ? Math.round(results.reduce((sum, r) => sum + estimateTokens(pageBody(r)), 0) / results.length)
    : 0;
  const baselineTokens = perPageBaseline * candidateCount;
  const groundingText = results.map((r) => `### ${r.slug}\n${pageBody(r).slice(0, GROUNDING_CHAR_CAP)}`).join('\n\n');
  const retrievalTokens = estimateTokens(groundingText);
  const reduction = baselineTokens > 0 ? (baselineTokens - retrievalTokens) / baselineTokens : 0;
  return {
    groundingText,
    tokenCost: {
      baseline_tokens: baselineTokens, retrieval_tokens: retrievalTokens,
      reduction_ratio: Math.max(0, Math.round(reduction * 1000) / 1000),
      candidate_count: candidateCount, retrieved_count: results.length,
    },
  };
}

/**
 * Ground a critique artifact on retrieved wiki context + measure the token-cost reduction.
 * @param {string} artifact - the critique artifact whose text seeds the retrieval query
 * @param {{topN?:number, queryClass?:string, wikiDir?:string, nowMs?:number}} [opts]
 * @returns {{groundingText:string, pages:Array, surface:string, tokenCost:{baseline_tokens:number,
 *   retrieval_tokens:number, reduction_ratio:number, candidate_count:number, retrieved_count:number}}}
 */
function groundArtifact(artifact, opts = {}) {
  const topN = opts.topN || DEFAULT_TOP_N;
  const queryClass = opts.queryClass || 'synthesis'; // wisdom-{global,project}: governance/research grounding
  const mirror = opts.wikiDir || ensureMirrorCache();
  const wikiDir = mirror ? (fs.existsSync(path.join(mirror, 'wiki')) ? path.join(mirror, 'wiki') : mirror) : undefined;
  let routed;
  try { routed = route({ query: deriveQuery(artifact), queryClass, topN, wikiDir }); }
  catch { routed = { results: [], telemetry: { candidate_count: 0 } }; }
  const results = routed.results || [];
  const candidateCount = (routed.telemetry && routed.telemetry.candidate_count) || results.length;
  const { groundingText, tokenCost } = measureGrounding(results, candidateCount);
  return {
    groundingText, tokenCost, surface: mirror ? 'wiki-mirror' : 'local',
    pages: results.map((r) => ({ slug: r.slug, path: r.path, score: r.score })),
  };
}

// Record the measured reduction as a schema-v3 G3/G8 signal (best-effort; never throws).
function recordReduction(grounding, meta = {}) {
  const event = {
    ts: meta.ts || new Date().toISOString(), version: 3, service: 'wiki-retrieval-baton',
    env: 'local', event: 'retrieval-token-cost', trigger_role: 'consultant',
    goal: 'G3', surface: grounding.surface, ...grounding.tokenCost,
    _summary: `retrieval grounded critique: ${grounding.tokenCost.retrieved_count}/${grounding.tokenCost.candidate_count} pages, `
      + `${Math.round(grounding.tokenCost.reduction_ratio * 100)}% token-cost reduction`,
  };
  try { fs.appendFileSync(EVENTS_LOG, JSON.stringify(event) + '\n'); } catch { /* best-effort G8 */ }
  return event;
}

module.exports = { groundArtifact, recordReduction, estimateTokens, deriveQuery, DEFAULT_TOP_N };

if (require.main === module) {
  const file = process.argv[2];
  if (!file) { console.error('usage: retrieval-baton <artifact.md> [--record]'); process.exit(1); }
  const artifact = fs.readFileSync(file, 'utf8');
  const grounding = groundArtifact(artifact);
  if (process.argv.includes('--record')) recordReduction(grounding);
  process.stdout.write(JSON.stringify({ tokenCost: grounding.tokenCost, pages: grounding.pages }, null, 2) + '\n');
  process.exit(0);
}
