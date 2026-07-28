#!/usr/bin/env node
// tier: 2
// hamr-mcp-adapter.js — MCP stdio server exposing HAMR capabilities as MCP tools.
// Epic #3041 C1 (#3043). Capabilities: governance_bundle_fetch, review_run, bundle_fetch,
// quota, substrate_health. Signs requests with Ed25519 DPoP via baton-signing.js.
// Tier-graceful: HAMR unavailable -> local governance-bundle.js fallback (never hard-fail).
// Register via .github/copilot-mcp.json (stdio transport). Refs #3043.
// Dark-launched behind MEGINGJORD_MCP_ADAPTER_ENABLED (default OFF, #3796, Epic #3789).
'use strict';

const { TOOLS } = require('./hamr-mcp-tools');
const { callHamr, localBundleFallback, buildSignedRequest } = require('./hamr-mcp-transport');

/** Convert a JSON-Schema-like inputSchema to a Zod shape for MCP tool registration.
 * @param {object} schema - tool inputSchema with type, properties, required
 * @param {object} zod - the imported zod module
 * @returns {object} a zod object schema matching the input definition
 */
function buildZodShape(schema, zod) {
  const shape = {};
  for (const [key, def] of Object.entries(schema.properties || {})) {
    let field = def.type === 'number' ? zod.number() : zod.string();
    if (def.description) field = field.describe(def.description);
    if (!(schema.required || []).includes(key)) field = field.optional();
    shape[key] = field;
  }
  return zod.object(shape);
}

/** Start the MCP stdio server. Gated by MEGINGJORD_MCP_ADAPTER_ENABLED (default OFF).
 * @param {{fetchImpl?: Function}} opts - optional overrides for testing
 * @returns {Promise<{served: boolean, reason?: string, flag?: string}>} startup result
 */
async function main(opts = {}) {
  const { mcpAdapterEnabled } = require('./mcp-adapter-gate');
  const gate = mcpAdapterEnabled();
  if (!gate.enabled) {
    return { served: false, reason: 'adapter-disabled-default-off', flag: gate.flag };
  }
  const { McpServer } = require('@modelcontextprotocol/sdk/server/mcp.js');
  const { StdioServerTransport } = require('@modelcontextprotocol/sdk/server/stdio.js');
  const { z } = require('zod');
  const server = new McpServer(
    { name: 'megingjord-hamr-mcp', version: '0.1.0' },
    { capabilities: { tools: {} } },
  );
  for (const tool of TOOLS) {
    const shape = buildZodShape(tool.inputSchema, z);
    server.registerTool(tool.name,
      { description: tool.description, inputSchema: shape },
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
  return { served: true };
}

if (require.main === module) {
  main().catch((err) => {
    process.stderr.write(`[hamr-mcp] startup failed: ${err.message}\n`);
    process.exit(1);
  });
}

module.exports = { TOOLS, callHamr, localBundleFallback, buildSignedRequest, main };
