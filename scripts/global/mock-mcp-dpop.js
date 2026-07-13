#!/usr/bin/env node
'use strict';
// tier: 0
// mock-mcp-dpop.js (#3794, Epic #3789) — $0/Tier-0 DPoP + token primitives for the mock
// MCP resource server (scripts/global/mock-mcp-resource-server.js). Ed25519 only; no cloud.
//
// Model (minimal, faithful to MCP 2025-11-25 / RFC 9449 DPoP + RFC 8707): an access token
// is bound to a proof key via a `cnf.jkt` JWK thumbprint. A request is accepted only when
// the presented DPoP proof (a) verifies under its embedded key, (b) whose thumbprint equals
// the token's cnf.jkt, (c) matches the method+URL, and (d) carries a fresh jti (no replay);
// AND the token's `aud` equals the resource server's own resource id (RFC 8707).
const crypto = require('node:crypto');

/** Deterministic JWK thumbprint (RFC 7638-style) of an Ed25519 public key. */
function jwkThumbprint(publicKey) {
  const raw = publicKey.export({ format: 'der', type: 'spki' });
  return crypto.createHash('sha256').update(raw).digest('base64url');
}

/** Generate an Ed25519 keypair (the "publisher" / client key, or the token issuer key). */
function genKeypair() {
  return crypto.generateKeyPairSync('ed25519');
}

function b64u(obj) { return Buffer.from(JSON.stringify(obj)).toString('base64url'); }
function unb64u(str) { return JSON.parse(Buffer.from(String(str), 'base64url').toString('utf8')); }

/** Mint an access token bound to `jkt`, audienced to `aud`, signed by the issuer key. */
function mintToken({ aud, jkt, issuerKey }) {
  const claims = { aud, cnf: { jkt }, iat: 1 };
  const payload = b64u(claims);
  const sig = crypto.sign(null, Buffer.from(payload), issuerKey).toString('base64url');
  return `${payload}.${sig}`;
}

/** Verify a token's issuer signature; return its claims or throw. */
function verifyToken(token, issuerPublicKey) {
  const [payload, sig] = String(token).split('.');
  if (!payload || !sig) throw new Error('malformed_token');
  const ok = crypto.verify(null, Buffer.from(payload), issuerPublicKey, Buffer.from(sig, 'base64url'));
  if (!ok) throw new Error('token_signature_invalid');
  return unb64u(payload);
}

/** Mint a DPoP proof for method+url with a fresh jti, signed by `proofKey`. The proof
 * carries its own public key (spki) + thumbprint (jkt) in the header, as the mock's
 * stand-in for the RFC 9449 `jwk` header member. */
function mintProof({ htm, htu, jti, proofKey, proofPublicKey }) {
  const spki = proofPublicKey.export({ format: 'der', type: 'spki' }).toString('base64url');
  const header = { typ: 'dpop+jwt', alg: 'EdDSA', spki, jkt: jwkThumbprint(proofPublicKey) };
  const signingInput = `${b64u(header)}.${b64u({ htm, htu, jti, iat: 1 })}`;
  const sig = crypto.sign(null, Buffer.from(signingInput), proofKey).toString('base64url');
  return `${signingInput}.${sig}`;
}

/** Verify a DPoP proof's self-signature and key/thumbprint consistency; return
 * {jkt, htm, htu, jti} or throw. A proof signed by one key while advertising a different
 * jkt (substitution) throws proof_thumbprint_mismatch. */
function verifyProof(proof) {
  const [h, c, sig] = String(proof).split('.');
  if (!h || !c || !sig) throw new Error('malformed_proof');
  const header = unb64u(h);
  const claims = unb64u(c);
  if (!header.spki) throw new Error('proof_missing_key');
  const key = crypto.createPublicKey({ key: Buffer.from(header.spki, 'base64url'), format: 'der', type: 'spki' });
  if (!crypto.verify(null, Buffer.from(`${h}.${c}`), key, Buffer.from(sig, 'base64url'))) {
    throw new Error('proof_signature_invalid');
  }
  if (jwkThumbprint(key) !== header.jkt) throw new Error('proof_thumbprint_mismatch');
  return { jkt: header.jkt, htm: claims.htm, htu: claims.htu, jti: claims.jti };
}

module.exports = { jwkThumbprint, genKeypair, mintToken, verifyToken, mintProof, verifyProof };
