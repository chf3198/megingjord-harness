#!/usr/bin/env node
// cache-hit-gate.js — HAMR Wave 4 child 3 (#926).
// Reads ~/.megingjord/cache-stats.jsonl, computes 7-day rolling hit rate, alerts <80%.
// Per v3.2 §R5: provider-native caching is the cost lever; gate guards regression.
'use strict';
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');

const CACHE_STATS_FILE = path.join(os.homedir(), '.megingjord', 'cache-stats.jsonl');
const HIT_RATE_FLOOR = 0.80;
const ROLLING_WINDOW_MS = 7 * 24 * 60 * 60 * 1000;

function readStatsJsonl(file = CACHE_STATS_FILE) {
  if (!fs.existsSync(file)) return [];
  const lines = fs.readFileSync(file, 'utf8').split('\n').filter(Boolean);
  const out = [];
  for (const line of lines) {
    try { out.push(JSON.parse(line)); } catch { /* skip malformed */ }
  }
  return out;
}

/** Compute rolling 7-day hit rate from in-memory records.
 * Each record: { ts: epoch_ms, provider: string, cache_read_tokens, input_tokens }.
 * Hit rate = sum(cache_read_tokens) / sum(input_tokens) within window.
 * @param {Array<object>} records - Cache-stat records.
 * @param {object} [opts] - { now, windowMs }.
 * @returns {{hit_rate: number|null, sample_count: number, cache_read_total: number, input_total: number}} Stats.
 */
function computeHitRate(records, opts = {}) {
  const now = opts.now ?? Date.now();
  const windowMs = opts.windowMs ?? ROLLING_WINDOW_MS;
  const cutoff = now - windowMs;
  let cacheRead = 0, inputTotal = 0, count = 0;
  for (const record of records) {
    if (typeof record.ts !== 'number' || record.ts < cutoff) continue;
    cacheRead += Number(record.cache_read_tokens || 0);
    inputTotal += Number(record.input_tokens || 0);
    count += 1;
  }
  return {
    hit_rate: inputTotal > 0 ? cacheRead / inputTotal : null,
    sample_count: count, cache_read_total: cacheRead, input_total: inputTotal,
  };
}

/** Run gate: compute rolling hit rate, return pass/fail vs floor.
 * @param {object} [opts] - { file, floor, now, windowMs }.
 * @returns {{passed: boolean, hit_rate: number|null, floor: number, alert: string|null}} Gate result.
 */
function runGate(opts = {}) {
  const records = readStatsJsonl(opts.file);
  const stats = computeHitRate(records, opts);
  const floor = opts.floor ?? HIT_RATE_FLOOR;
  if (stats.hit_rate === null) {
    return { passed: false, ...stats, floor, alert: 'no_samples_in_window' };
  }
  const passed = stats.hit_rate >= floor;
  return {
    passed, ...stats, floor,
    alert: passed ? null : `hit_rate_${stats.hit_rate.toFixed(3)}_below_floor_${floor}`,
  };
}

if (require.main === module) {
  const result = runGate();
  console.log(JSON.stringify(result, null, 2));
  process.exit(result.passed ? 0 : 1);
}

module.exports = { readStatsJsonl, computeHitRate, runGate, CACHE_STATS_FILE, HIT_RATE_FLOOR };
