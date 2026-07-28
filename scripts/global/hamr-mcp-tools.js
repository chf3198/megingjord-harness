#!/usr/bin/env node
// tier: 2
// hamr-mcp-tools.js — MCP tool definitions for the HAMR adapter.
// Split from hamr-mcp-adapter.js for the 100-line design contract. Refs #3796, Epic #3789.
// Epic #3041 C1 (#3043). Five capabilities: governance_bundle_fetch, review_run,
// bundle_fetch, quota, substrate_health.
'use strict';

const { isDisabled, callHamr, localBundleFallback } = require('./hamr-mcp-transport');

// Tool definitions — each exposed as an MCP tool
const TOOLS = [
  {
    name: 'governance_bundle_fetch',
    description: 'Fetch or generate the governance bundle for a ticket (HAMR then local fallback)',
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

module.exports = { TOOLS };
