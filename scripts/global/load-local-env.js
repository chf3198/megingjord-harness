#!/usr/bin/env node
'use strict';
// tier: 1
// load-local-env.js (#2645): hydrate process.env from the repo-root `.env` so zero-cost review and
// provider dispatch (fleet + free-cloud) find keys with NO manual `set -a; . ./.env` step. G3 enabler.
// Contract: fill-don't-override (G2 precedence), never logs values (G4), graceful on missing/malformed
// (G5/G6), one redaction-safe audit line of NAMES only (G8), env-based so all runtimes share it (G9).
const fs = require('node:fs');
const path = require('node:path');

let redactString;
try { ({ redactString } = require('./log-redaction')); }
catch { redactString = (text) => ({ text }); } // redactString returns { text, hits }

// Repo root is two levels up from scripts/global/.
const DEFAULT_ENV_PATH = path.resolve(__dirname, '..', '..', '.env');

let hydratedOnce = false;

/**
 * Parse `.env` text into ordered [name, value] pairs.
 * Skips blank lines, comments, and malformed entries; strips an optional `export ` and surrounding quotes.
 * @param {string} text raw file contents @returns {Array<[string,string]>}
 */
function parseEnv(text) {
  const pairs = [];
  for (const rawLine of String(text).split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) continue;
    const body = line.startsWith('export ') ? line.slice(7).trim() : line;
    const splitAt = body.indexOf('=');
    if (splitAt <= 0) continue; // no key, or leading '=' — malformed, skip
    const name = body.slice(0, splitAt).trim();
    if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(name)) continue; // not a shell identifier — skip
    let value = body.slice(splitAt + 1).trim();
    const quoted = value.length >= 2 &&
      ((value[0] === '"' && value.endsWith('"')) || (value[0] === "'" && value.endsWith("'")));
    if (quoted) value = value.slice(1, -1);
    pairs.push([name, value]);
  }
  return pairs;
}

/**
 * Fill only the keys absent from targetEnv (never override an explicit/CI value).
 * @param {object} targetEnv @param {Array<[string,string]>} pairs @returns {string[]} names filled
 */
function hydrate(targetEnv, pairs) {
  const filled = [];
  for (const [name, value] of pairs) {
    if (targetEnv[name] === undefined) { targetEnv[name] = value; filled.push(name); }
  }
  return filled;
}

/**
 * Load the repo-root `.env` into process.env. Fill-don't-override; redaction-safe; never throws.
 * @param {{env?:object,path?:string,quiet?:boolean}} opts @returns {{filled:string[],skipped:?string}}
 */
function loadLocalEnv(opts = {}) {
  const targetEnv = opts.env || process.env;
  if (targetEnv.MEGINGJORD_NO_DOTENV === '1') return { filled: [], skipped: 'disabled' };
  const envPath = opts.path || targetEnv.MEGINGJORD_DOTENV_PATH || DEFAULT_ENV_PATH;
  let text;
  try { text = fs.readFileSync(envPath, 'utf8'); }
  catch { return { filled: [], skipped: 'missing' }; } // G5/G6: no file -> pass-through to real env
  let filled = [];
  try { filled = hydrate(targetEnv, parseEnv(text)); }
  catch { return { filled: [], skipped: 'parse-error' }; } // never throw into the dispatch path
  if (filled.length && !opts.quiet) {
    const auditLine = `env-hydrate: filled=[${filled.join(',')}] count=${filled.length} source=.env`;
    process.stderr.write(`${redactString(auditLine).text}\n`); // NAMES only, value-free + redaction-safe
  }
  return { filled, skipped: null };
}

/**
 * Idempotent once-per-process hydration of the real process.env, for hot dispatch paths.
 * @returns {{filled:string[],skipped:?string}}
 */
function loadLocalEnvOnce() {
  if (hydratedOnce) return { filled: [], skipped: 'cached' };
  hydratedOnce = true;
  return loadLocalEnv();
}

module.exports = { loadLocalEnv, loadLocalEnvOnce, parseEnv, hydrate, DEFAULT_ENV_PATH };

if (require.main === module) loadLocalEnv();
