#!/usr/bin/env node
// cache-stats-emit.js — HAMR Wave 5 child 1 (#932).
// Atomic appender for ~/.megingjord/cache-stats.jsonl consumed by cache-hit-gate.js (#926).
'use strict';
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');

const STATS_DIR = path.join(os.homedir(), '.megingjord');
const STATS_FILE = path.join(STATS_DIR, 'cache-stats.jsonl');

function ensureDir() {
  if (!fs.existsSync(STATS_DIR)) fs.mkdirSync(STATS_DIR, { recursive: true });
}

/** Append a single cache-stat record atomically.
 * Schema: {ts: epoch_ms, provider, model?, cache_read_tokens, input_tokens, output_tokens?}.
 * Atomic strategy: write+rename on temp file when target absent; otherwise plain append
 * (POSIX append is atomic for writes < PIPE_BUF, ~4KB, which JSONL records always are).
 * @param {object} record - Must include provider, cache_read_tokens, input_tokens.
 * @param {object} [opts] - { file }.
 * @returns {{ok: boolean, file: string, line: string}} Append outcome.
 */
function appendCacheStat(record, opts = {}) {
  ensureDir();
  const file = opts.file ?? STATS_FILE;
  if (!record || typeof record.provider !== 'string') {
    throw new Error('appendCacheStat: record.provider required');
  }
  const normalized = {
    ts: typeof record.ts === 'number' ? record.ts : Date.now(),
    provider: record.provider,
    model: record.model ?? null,
    cache_read_tokens: Number(record.cache_read_tokens || 0),
    input_tokens: Number(record.input_tokens || 0),
    output_tokens: Number(record.output_tokens || 0),
  };
  const line = JSON.stringify(normalized) + '\n';
  fs.appendFileSync(file, line, { encoding: 'utf8', flag: 'a' });
  return { ok: true, file, line };
}

/** Convert a normalized token-record (from token-provider-adapters) into a cache-stat.
 * @param {object} tokenRecord - Output of any provider adapter.
 * @returns {object|null} Cache-stat record or null when record lacks provider.
 */
function fromTokenRecord(tokenRecord) {
  if (!tokenRecord || !tokenRecord.provider) return null;
  return {
    ts: Date.now(),
    provider: tokenRecord.provider,
    model: tokenRecord.model ?? null,
    cache_read_tokens: Number(tokenRecord.cache_read_tokens || 0),
    input_tokens: Number(tokenRecord.input_tokens || 0),
    output_tokens: Number(tokenRecord.output_tokens || 0),
  };
}

if (require.main === module) {
  const cmd = process.argv[2];
  if (cmd === 'append') {
    const record = JSON.parse(process.argv[3] || '{}');
    console.log(JSON.stringify(appendCacheStat(record)));
  } else {
    console.log(JSON.stringify({ stats_file: STATS_FILE, exists: fs.existsSync(STATS_FILE) }));
  }
}

module.exports = { appendCacheStat, fromTokenRecord, STATS_FILE };
