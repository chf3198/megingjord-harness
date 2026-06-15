'use strict';

const { test, expect } = require('@playwright/test');
const {
  validateContextEnvelope,
  validateCapabilityManifest,
} = require('../scripts/global/fleet-envelope-contract.js');

test('contract: context envelope rejects mismatched observability linkage', () => {
  const envelope = {
    prompt: 'p',
    manifest: { schema: 'fleet-context-bundle/v1', included: ['repoMap'] },
    included: ['repoMap'],
    truncated: false,
    observability: {
      schema: 'fleet-context-envelope/v1',
      manifestSchema: 'fleet-context-bundle/v1',
      included: ['ticket'],
      truncated: false,
    },
  };
  expect(() => validateContextEnvelope(envelope))
    .toThrow(/observability\.included must match included/);
});

test('contract: capability manifest rejects stale schema version', () => {
  const manifest = {
    schema_version: 1,
    probed_at: new Date().toISOString(),
    tailscale: {},
    fleet: {},
    cloudflare: { account: {} },
    providers: {},
    mcp: { rag_server: {} },
    r2: {},
    wrangler: {},
    github_oidc: {},
    npm_trusted_publishing: {},
  };
  expect(() => validateCapabilityManifest(manifest))
    .toThrow(/schema_version must be 2/);
});
