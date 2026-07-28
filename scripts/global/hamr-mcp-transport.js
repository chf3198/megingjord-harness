#!/usr/bin/env node
// tier: 2
// hamr-mcp-transport.js — HAMR transport layer: DPoP-signed HTTP calls and local fallback.
// Split from hamr-mcp-adapter.js for the 100-line design contract. Refs #3796, Epic #3789.
// Epic #3041 C1 (#3043). Signs requests with Ed25519 DPoP via baton-signing.js.
// Tier-graceful: HAMR unavailable -> local governance-bundle.js fallback (never hard-fail).
'use strict';

require('./load-local-env').loadLocalEnvOnce();
const { sign } = require('./baton-signing');
const { buildBundle } = require('./governance-bundle');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');

const HAMR_URL = process.env.HAMR_URL || 'https://hamr.chf3198.workers.dev';
const FIELDS_DIR = path.join(os.homedir(), '.megingjord');

/** Read at call time so tests can toggle MEGINGJORD_HAMR_DISABLED mid-run.
 * @returns {boolean} true when the per-capability kill-switch is set
 */
function isDisabled() { return process.env.MEGINGJORD_HAMR_DISABLED === '1'; }

/** Build a DPoP-signed POST body + headers for a HAMR /mcp capability call.
 * @param {string} capability - the HAMR capability identifier
 * @param {object} params - capability parameters
 * @returns {Promise<{headers: object, body: string}>} signed request parts
 */
async function buildSignedRequest(capability, params) {
  const payload = JSON.stringify({ capability, params });
  const { signature, key_id, publicKey } = await sign(payload);
  return {
    headers: {
      'content-type': 'application/json',
      authorization: `DPoP ${key_id}`,
      'x-hamr-dpop-sig': signature,
      'x-hamr-pub-key': publicKey,
    },
    body: payload,
  };
}

/** POST to HAMR /mcp with DPoP auth. Returns parsed JSON or throws.
 * @param {string} capability - the HAMR capability identifier
 * @param {object} params - capability parameters
 * @param {{fetchImpl?: Function}} opts - optional fetch override for testing
 * @returns {Promise<object>} parsed HAMR response
 */
async function callHamr(capability, params, opts = {}) {
  const { headers, body } = await buildSignedRequest(capability, params);
  const doFetch = opts.fetchImpl || fetch;
  const resp = await doFetch(`${HAMR_URL}/mcp`, { method: 'POST', headers, body });
  if (!resp.ok) throw new Error(`HAMR /mcp returned ${resp.status}`);
  return resp.json();
}

/** Local fallback: read governance-fields snapshot and build a bundle in-process.
 * @param {number|string} issue - GitHub issue number
 * @returns {object} bundle (governance-bundle v1 schema) with source: local-fallback
 */
function localBundleFallback(issue) {
  const fieldsFile = path.join(FIELDS_DIR, `governance-fields-${issue}.json`);
  let fields = {};
  try { fields = JSON.parse(fs.readFileSync(fieldsFile, 'utf8')); } catch { /* use empty */ }
  const bundle = buildBundle({ issue, fields, nowMs: Date.now() });
  return { ...bundle, source: 'local-fallback' };
}

module.exports = { isDisabled, buildSignedRequest, callHamr, localBundleFallback, HAMR_URL, FIELDS_DIR };
