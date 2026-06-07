#!/usr/bin/env node
// hamr-coverage-handlers.js — API for the HAMR cost-coverage panel.
// (#1159) Aggregates the zero-cost-lane G3 signals — cache-hit-rate-7d, per-provider call mix,
// premium-share governor, tier-mix — from ~/.megingjord/cache-stats.jsonl into one /api/hamr-coverage
// payload, so an operator can SEE whether the harness is staying in the free lanes (G8-in-service-of-G3).
'use strict';

const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const CACHE_STATS = path.join(os.homedir(), '.megingjord', 'cache-stats.jsonl');
const WEEK_MS = 604800000;
// Cost-ascending mandate: tiers above the free/fleet lanes. premium-share over these forces fleet (#2619).
const PREMIUM_TIERS = new Set(['haiku', 'premium', 'paid']);
const PREMIUM_GOVERNOR_THRESHOLD = 0.2; // >20% premium over 7d trips the governor warning
const CACHE_HIT_SLO = 0.3;              // hit-rate floor below which the gauge flags a G3 warning

/** Read cache-stats records; missing/garbled lines degrade to [] (G6), never throw. */
function readCacheStats(file = CACHE_STATS) {
  if (!fs.existsSync(file)) return [];
  return fs.readFileSync(file, 'utf8').split('\n').filter(Boolean).map((line) => {
    try { return JSON.parse(line); } catch { return null; }
  }).filter(Boolean);
}

function round(value) { return Math.round(value * 1000) / 1000; }

/** Shape raw cache-stat records into the coverage payload. Pure — unit-tested without a browser. */
function computeHamrCoverage(records, nowMs = Date.now()) {
  const recent = (records || []).filter((rec) => rec && nowMs - Number(rec.ts || 0) <= WEEK_MS);
  const providers = {};
  const tiers = {};
  let eligible = 0; let hits = 0; let premium = 0;
  for (const rec of recent) {
    const name = rec.provider || 'unknown';
    providers[name] = (providers[name] || 0) + 1;
    const tier = rec.tier || 'unknown';
    tiers[tier] = (tiers[tier] || 0) + 1;
    if (rec.cache_eligible) { eligible += 1; if (Number(rec.cache_read_tokens) > 0) hits += 1; }
    if (PREMIUM_TIERS.has(tier)) premium += 1;
  }
  const total = recent.length;
  const hitRate = eligible ? hits / eligible : 0;
  const premiumShare = total ? premium / total : 0;
  const breached = premiumShare > PREMIUM_GOVERNOR_THRESHOLD || (eligible > 0 && hitRate < CACHE_HIT_SLO);
  return {
    coverage_rate: round(hitRate),
    cache_hit_slo: CACHE_HIT_SLO,
    providers: Object.entries(providers).map(([nm, calls]) => (
      { name: nm, calls, share: round(calls / (total || 1)) })),
    tier_mix: Object.entries(tiers).map(([nm, calls]) => (
      { tier: nm, calls, share: round(calls / (total || 1)) })),
    premium_share_7d: round(premiumShare),
    governor: { breached, threshold: PREMIUM_GOVERNOR_THRESHOLD },
    total_calls_7d: total,
  };
}

function handleHamrCoverage(_request, response) {
  const summary = {
    ...computeHamrCoverage(readCacheStats()),
    generated_at: new Date().toISOString(),
    source: CACHE_STATS,
  };
  response.writeHead(Number('200'), { 'Content-Type': 'application/json' });
  response.end(JSON.stringify(summary));
}

module.exports = {
  handleHamrCoverage, computeHamrCoverage, readCacheStats, round,
  PREMIUM_GOVERNOR_THRESHOLD, CACHE_HIT_SLO,
};
