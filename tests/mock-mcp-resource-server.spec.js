// mock-mcp-resource-server.spec.js -- Conformance tests for the $0 mock MCP resource server.
// Refs #3794, Epic #3789. AC1 PRM + DPoP-gated /mcp; AC2-AC4 negatives; AC5 no-key-leak;
// AC6 ephemeral_verification_evidence. test_strategy: tdd-pyramid (+stress spec sibling).
'use strict';

const { describe, it, before, after } = require('node:test');
const assert = require('node:assert/strict');
const http = require('node:http');

const { createMockServer, prm } = require('../scripts/global/mock-mcp-resource-server');
const dpop = require('../scripts/global/mock-mcp-dpop');
const { runNegatives } = require('../scripts/global/mock-mcp-verify');

const RESOURCE = 'https://rs.local';

/** GET a path off the running mock; resolve {status, json}. */
function get(port, path) {
  return new Promise((resolve, reject) => {
    http.get({ host: '127.0.0.1', port, path }, (res) => {
      let b = ''; res.on('data', (d) => { b += d; });
      res.on('end', () => resolve({ status: res.statusCode, json: b ? JSON.parse(b) : null }));
    }).on('error', reject);
  });
}

describe('mock-mcp-resource-server', () => {
  let server; let port; let issuer;
  before(async () => {
    issuer = dpop.genKeypair();
    server = createMockServer({ resource: RESOURCE, issuerPublicKey: issuer.publicKey });
    await new Promise((r) => server.listen(0, '127.0.0.1', r));
    port = server.address().port;
  });
  after(() => server.close());

  describe('AC1: RFC 9728 Protected Resource Metadata', () => {
    it('serves /.well-known/oauth-protected-resource with the required members', async () => {
      const { status, json } = await get(port, '/.well-known/oauth-protected-resource');
      assert.equal(status, 200);
      assert.equal(json.resource, RESOURCE);
      assert.ok(Array.isArray(json.authorization_servers) && json.authorization_servers.length);
      assert.deepEqual(json.bearer_methods_supported, ['header']);
      assert.deepEqual(json.dpop_signing_alg_values_supported, ['EdDSA']);
    });
    it('prm() is a pure builder', () => {
      assert.equal(prm('https://x').resource, 'https://x');
    });
  });

  describe('AC2-AC6: security negatives via the end-to-end driver', () => {
    let evidence;
    before(async () => { evidence = await runNegatives(); });

    it('accepts a fully valid, correctly-audienced, fresh, signed request (200)', () => {
      assert.equal(evidence.tests.find((t) => t.name === 'positive').got, 200);
    });
    it('AC2: rejects a forged proof (proof key not bound to the token) with 401', () => {
      assert.equal(evidence.tests.find((t) => t.name === 'forged-proof').got, 401);
    });
    it('AC3: rejects a replayed proof (reused jti) with 401', () => {
      assert.equal(evidence.tests.find((t) => t.name === 'replay').got, 401);
    });
    it('AC4: rejects a wrong-audience token (RFC 8707) with 403 invalid_target', () => {
      assert.equal(evidence.tests.find((t) => t.name === 'wrong-audience').got, 403);
    });
    it('AC5: no private-key material leaks into the transcript', () => {
      assert.equal(evidence.tests.find((t) => t.name === 'no-key-leak').got, 'absent');
    });
    it('AC6: emits an ephemeral_verification_evidence block with all_pass + transcript_sha256', () => {
      assert.equal(evidence.schema, 'ephemeral_verification_evidence');
      assert.equal(evidence.all_pass, true);
      assert.match(evidence.transcript_sha256, /^[0-9a-f]{64}$/);
      assert.equal(evidence.tests.length, 5);
    });
  });

  describe('evaluate() unit branches (fail-closed on absent credentials)', () => {
    const { evaluate } = require('../scripts/global/mock-mcp-resource-server');
    it('401 invalid_token when the DPoP Authorization header is absent', () => {
      const r = evaluate({ headers: {} }, RESOURCE, issuer.publicKey, new Set());
      assert.deepEqual(r, { status: 401, error: 'invalid_token' });
    });
    it('401 invalid_token when the DPoP proof header is absent', () => {
      const r = evaluate({ headers: { authorization: 'DPoP abc' } }, RESOURCE, issuer.publicKey, new Set());
      assert.deepEqual(r, { status: 401, error: 'invalid_token' });
    });
    it('401 invalid_token when the token signature is garbage', () => {
      const r = evaluate({ headers: { authorization: 'DPoP not.a.token', dpop: 'x.y.z' } },
        RESOURCE, issuer.publicKey, new Set());
      assert.equal(r.status, 401);
    });
  });
});
