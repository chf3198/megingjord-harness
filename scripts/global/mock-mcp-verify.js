#!/usr/bin/env node
'use strict';
// tier: 0
// mock-mcp-verify.js (#3794, Epic #3789) — drives scripts/global/mock-mcp-resource-server.js
// end-to-end through the four mandatory security negatives (forged proof / replay / wrong
// audience / key leak) plus one positive, and emits the ephemeral_verification_evidence
// block (per-test PASS + transcript_sha256) the lane's canary/artifacts consume (#3795).
const http = require('node:http');
const crypto = require('node:crypto');
const dpop = require('./mock-mcp-dpop');
const { createMockServer, STATUS } = require('./mock-mcp-resource-server');

const LOOPBACK = '127.0.0.1';
const RESOURCE = 'https://rs.local'; // logical RFC 8707 resource id, decoupled from transport

/** POST /mcp with the given token + proof; resolve {status, body}. */
function postMcp(port, token, proof) {
  return new Promise((resolve, reject) => {
    const req = http.request({ host: LOOPBACK, port, path: '/mcp', method: 'POST',
      headers: { authorization: `DPoP ${token}`, dpop: proof } }, (res) => {
      let body = ''; res.on('data', (chunk) => { body += chunk; }); res.on('end', () => resolve({ status: res.statusCode, body }));
    });
    req.on('error', reject); req.end();
  });
}

/** Start a fresh mock bound to an ephemeral port; return {srv, port, keys}. */
async function startMock() {
  const keys = { issuer: dpop.genKeypair(), publisher: dpop.genKeypair(), attacker: dpop.genKeypair() };
  const srv = createMockServer({ resource: RESOURCE, issuerPublicKey: keys.issuer.publicKey });
  await new Promise((ready) => srv.listen(0, LOOPBACK, ready));
  return { srv, port: srv.address().port, keys };
}

/** Run the four negatives + a positive against a fresh mock. Returns the evidence block. */
async function runNegatives() {
  const { srv, port, keys } = await startMock();
  const jkt = dpop.jwkThumbprint(keys.publisher.publicKey);
  const goodTok = dpop.mintToken({ aud: RESOURCE, jkt, issuerKey: keys.issuer.privateKey });
  const wrongTok = dpop.mintToken({ aud: `${RESOURCE}/other`, jkt, issuerKey: keys.issuer.privateKey });
  const proof = (kp, jti) => dpop.mintProof({ htm: 'POST', htu: `${RESOURCE}/mcp`, jti, proofKey: kp.privateKey, proofPublicKey: kp.publicKey });
  const transcript = [];
  const record = async (name, expect, token, pf) => {
    const { status, body } = await postMcp(port, token, pf);
    transcript.push(`${name}: expect ${expect} got ${status} body ${body}`);
    return { name, expect, got: status, pass: status === expect };
  };
  const valid = proof(keys.publisher, 'jti-A');
  const results = [
    await record('positive', STATUS.OK, goodTok, valid),
    await record('forged-proof', STATUS.UNAUTHORIZED, goodTok, proof(keys.attacker, 'jti-B')),
    await record('replay', STATUS.UNAUTHORIZED, goodTok, valid),
    await record('wrong-audience', STATUS.FORBIDDEN, wrongTok, proof(keys.publisher, 'jti-C')),
  ];
  results.push(noKeyLeak(keys.publisher, transcript));
  srv.close();
  return { schema: 'ephemeral_verification_evidence', all_pass: results.every((t) => t.pass),
    tests: results, transcript_sha256: crypto.createHash('sha256').update(transcript.join('\n')).digest('hex') };
}

/** Assert the publisher private key material never appears in the transcript (AC5). */
function noKeyLeak(publisher, transcript) {
  const secret = publisher.privateKey.export({ format: 'der', type: 'pkcs8' }).toString('base64url');
  const text = transcript.join('\n');
  const leaked = text.includes(secret) || text.includes(secret.slice(0, 32));
  return { name: 'no-key-leak', expect: 'absent', got: leaked ? 'leaked' : 'absent', pass: !leaked };
}

if (require.main === module) {
  runNegatives().then((ev) => { console.log(JSON.stringify(ev, null, 2)); process.exit(ev.all_pass ? 0 : 1); });
}

module.exports = { runNegatives, postMcp, startMock };
