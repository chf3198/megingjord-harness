#!/usr/bin/env node
// tier: 2
// hamr-mcp-adapter.js — MCP stdio server exposing HAMR capabilities as MCP tools.
// Epic #3041 C1 (#3043). Capabilities: governance_bundle_fetch, review_run, bundle_fetch,
// quota, substrate_health. Signs requests with Ed25519 DPoP via baton-signing.js.
// Tier-graceful: HAMR unavailable → local governance-bundle.js fallback (never hard-fail).
// Register via .github/copilot-mcp.json (stdio transport). Refs #3043.
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
 * @returns {boolean}
 */
function isDisabled() { return process.env.MEGINGJORD_HAMR_DISABLED === '1'; }

/** Build a DPoP-signed POST body + headers for a HAMR /mcp capability call.
 * @param {string} capability
 * @param {object} params
 * @returns {Promise<{headers: object, body: string}>}
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
 * @param {string} capability
 * @param {object} params
 * @param {{fetchImpl?: Function}} opts
 * @returns {Promise<object>}
 */
async function callHamr(capability, params, opts = {}) {
  const { headers, body } = await buildSignedRequest(capability, params);
  const doFetch = opts.fetchImpl || fetch;
  const resp = await doFetch(`${HAMR_URL}/mcp`, { method: 'POST', headers, body });
  if (!resp.ok) throw new Error(`HAMR /mcp returned ${resp.status}`);
  return resp.json();
}

/** Local fallback: read governance-fields snapshot and build a bundle in-process.
 * @param {number|string} issue
 * @returns {object} bundle (governance-bundle v1 schema) or error shell
 */
function localBundleFallback(issue) {
  const fieldsFile = path.join(FIELDS_DIR, `governance-fields-${issue}.json`);
  let fields = {};
  try { fields = JSON.parse(fs.readFileSync(fieldsFile, 'utf8')); } catch { /* use empty */ }
  const bundle = buildBundle({ issue, fields, nowMs: Date.now() });
  return { ...bundle, source: 'local-fallback' };
}

// Tool definitions — each exposed as an MCP tool
const TOOLS = [
  {
    name: 'governance_bundle_fetch',
    description: 'Fetch or generate the governance bundle for a ticket (HAMR → local fallback)',
    inputSchema: {
      type: 'object',
      properties: { issue: { type: 'number', description: 'GitHub issue number' } },
      required: ['issue'],
    },
    async handler({ issue }, opts) {
      if (isDisabled()) return localBundleFallback(issue);
      try {
        const data = await callHamr('tool:governance-bundle', { issue }, opts);
        return { ...data, source: 'hamr' };
      } catch {
        return localBundleFallback(issue);
      }
    },
  },
  {
    name: 'review_run',
    description: 'Trigger a fleet-consultant governance review run via HAMR',
    inputSchema: {
      type: 'object',
      properties: {
        issue: { type: 'number' },
        model: { type: 'string', description: 'Fleet model slug' },
      },
      required: ['issue'],
    },
    async handler({ issue, model }, opts) {
      if (isDisabled()) return { ok: false, reason: 'hamr-disabled' };
      return callHamr('review:run', { issue, model }, opts);
    },
  },
  {
    name: 'bundle_fetch',
    description: 'Fetch a raw HAMR KV bundle by key',
    inputSchema: {
      type: 'object',
      properties: { key: { type: 'string', description: 'KV key to fetch' } },
      required: ['key'],
    },
    async handler({ key }, opts) {
      if (isDisabled()) return { ok: false, reason: 'hamr-disabled' };
      return callHamr('bundle:fetch', { key }, opts);
    },
  },
  {
    name: 'quota',
    description: 'Retrieve HAMR quota and cache-hit-rate snapshot',
    inputSchema: { type: 'object', properties: {} },
    async handler(_args, opts) {
      if (isDisabled()) return { ok: false, reason: 'hamr-disabled' };
      return callHamr('bundle:fetch', { key: 'cache-stats:hit-rate-7d' }, opts);
    },
  },
  {
    name: 'substrate_health',
    description: 'Retrieve HAMR substrate-health snapshot',
    inputSchema: { type: 'object', properties: {} },
    async handler(_args, opts) {
      if (isDisabled()) return { ok: false, reason: 'hamr-disabled' };
      return callHamr('doctor:probe', {}, opts);
    },
  },
];

/** Start the MCP stdio server. Requires @modelcontextprotocol/sdk.
 * @param {{fetchImpl?: Function}} opts - for testing
 */
async function main(opts = {}) {
  const { McpServer } = require('@modelcontextprotocol/sdk/server/mcp.js');
  const { StdioServerTransport } = require('@modelcontextprotocol/sdk/server/stdio.js');
  const { z } = require('zod');
  const server = new McpServer(
    { name: 'megingjord-hamr-mcp', version: '0.1.0' },
    { capabilities: { tools: {} } },
  );
  for (const tool of TOOLS) {
    const shape = buildZodShape(tool.inputSchema, z);
    server.registerTool(tool.name, { description: tool.description, inputSchema: shape },
      async (args) => {
        try {
          const result = await tool.handler(args || {}, opts);
          return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
        } catch (err) {
          return { content: [{ type: 'text', text: JSON.stringify({ ok: false, error: err.message }) }] };
        }
      });
  }
  await server.connect(new StdioServerTransport());
}

function buildZodShape(schema, z) {
  const shape = {};
  for (const [key, def] of Object.entries(schema.properties || {})) {
    let field = def.type === 'number' ? z.number() : z.string();
    if (def.description) field = field.describe(def.description);
    if (!(schema.required || []).includes(key)) field = field.optional();
    shape[key] = field;
  }
  return z.object(shape);
}

if (require.main === module) {
  main().catch((err) => {
    process.stderr.write(`[hamr-mcp] startup failed: ${err.message}\n`);
    process.exit(1);
  });
}

module.exports = { TOOLS, callHamr, localBundleFallback, buildSignedRequest, main };
