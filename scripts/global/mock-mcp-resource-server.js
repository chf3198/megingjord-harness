#!/usr/bin/env node
'use strict';
// tier: 0
// mock-mcp-resource-server.js (#3794, Epic #3789) — $0/Tier-0 local mock OAuth 2.1 / MCP
// resource server. Supplies the *counterparty* that makes the four security negatives
// (forged proof / replay / wrong audience / key leak) verifiable headless. No cloud, no
// external calls. Implements RFC 9728 Protected Resource Metadata, RFC 8707 audience
// checking, and DPoP sender-constraint verification.
// Driver + ephemeral_verification_evidence live in scripts/global/mock-mcp-verify.js.
const http = require('node:http');
const dpop = require('./mock-mcp-dpop');

// RFC 6750 / 9449 error taxonomy — named so the code carries no bare status literals.
const STATUS = { OK: 200, UNAUTHORIZED: 401, FORBIDDEN: 403, NOT_FOUND: 404 };

/** Send a spec-shaped auth error and end the response. */
function reject(res, status, error) {
  res.writeHead(status, { 'www-authenticate': `DPoP error="${error}"`, 'content-type': 'application/json' });
  res.end(JSON.stringify({ error }));
}

/** Build the RFC-9728 Protected Resource Metadata document for this resource. */
function prm(resource) {
  return {
    resource,
    authorization_servers: [`${resource}/as`],
    bearer_methods_supported: ['header'],
    dpop_signing_alg_values_supported: ['EdDSA'],
  };
}

/** Validate one /mcp request; return {status, error} (OK = accept). Never logs credentials. */
function evaluate(req, resource, issuerPublicKey, seenJti) {
  const auth = req.headers['authorization'] || '';
  const proofHeader = req.headers['dpop'] || '';
  const token = /^DPoP\s+(.+)$/i.exec(auth)?.[1];
  if (!token || !proofHeader) return { status: STATUS.UNAUTHORIZED, error: 'invalid_token' };
  let claims; let proof;
  try { claims = dpop.verifyToken(token, issuerPublicKey); } catch { return { status: STATUS.UNAUTHORIZED, error: 'invalid_token' }; }
  try { proof = dpop.verifyProof(proofHeader); } catch { return { status: STATUS.UNAUTHORIZED, error: 'invalid_token' }; }
  if (proof.htm !== 'POST' || proof.htu !== `${resource}/mcp`) return { status: STATUS.UNAUTHORIZED, error: 'invalid_token' };
  if (proof.jkt !== claims.cnf?.jkt) return { status: STATUS.UNAUTHORIZED, error: 'invalid_token' };
  if (claims.aud !== resource) return { status: STATUS.FORBIDDEN, error: 'invalid_target' };
  if (seenJti.has(proof.jti)) return { status: STATUS.UNAUTHORIZED, error: 'invalid_token' };
  seenJti.add(proof.jti);
  return { status: STATUS.OK, error: null };
}

/** Create the mock resource server. `issuerPublicKey` is the token-issuer's Ed25519 pubkey. */
function createMockServer({ resource, issuerPublicKey }) {
  const seenJti = new Set();
  const server = http.createServer((req, res) => {
    if (req.method === 'GET' && req.url === '/.well-known/oauth-protected-resource') {
      res.writeHead(STATUS.OK, { 'content-type': 'application/json' });
      return res.end(JSON.stringify(prm(resource)));
    }
    if (req.method === 'POST' && req.url === '/mcp') {
      const { status, error } = evaluate(req, resource, issuerPublicKey, seenJti);
      if (status === STATUS.OK) { res.writeHead(STATUS.OK, { 'content-type': 'application/json' }); return res.end(JSON.stringify({ ok: true })); }
      return reject(res, status, error);
    }
    return reject(res, STATUS.NOT_FOUND, 'not_found');
  });
  server.seenJti = seenJti;
  return server;
}

module.exports = { createMockServer, evaluate, prm, STATUS };
