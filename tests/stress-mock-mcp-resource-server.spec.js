// stress-mock-mcp-resource-server.spec.js -- Stress/adversarial-input coverage for the mock
// MCP resource server. Refs #3794, Epic #3789. test_strategy stress-test: this surface is an
// adversarial-input parser (DPoP/token headers from an untrusted client), so per the
// test-methodology-matrix it MUST assert (G6) a fault-injection path AND (G7) a p99 budget.
'use strict';

const { describe, it, before, after } = require('node:test');
const assert = require('node:assert/strict');
const http = require('node:http');

const { createMockServer, evaluate } = require('../scripts/global/mock-mcp-resource-server');
const dpop = require('../scripts/global/mock-mcp-dpop');

const RESOURCE = 'https://rs.local';
const ISSUER = dpop.genKeypair();

/** Deterministic pseudo-random adversarial header value for fuzz index i (no Math.random). */
function fuzz(i) {
  const shapes = [
    '', 'DPoP', 'DPoP ', 'Bearer x', `DPoP ${'A'.repeat((i * 37) % 5000)}`,
    'DPoP .', 'DPoP a.b', 'DPoP a.b.c.d', `DPoP ${i}.${i}`, 'DPoP \x00\x01\x02',
    `DPoP ${Buffer.from(String(i)).toString('base64url')}`, 'DPoP null.null',
  ];
  return shapes[i % shapes.length];
}

describe('stress: adversarial-input resilience (G6 fault-injection)', () => {
  it('evaluate() never throws on 2000 malformed credential combinations — always 401/403', () => {
    const seen = new Set();
    for (let i = 0; i < 2000; i += 1) {
      const req = { headers: { authorization: fuzz(i), dpop: fuzz(i + 7) } };
      let res;
      assert.doesNotThrow(() => { res = evaluate(req, RESOURCE, ISSUER.publicKey, seen); },
        `fuzz index ${i} threw`);
      assert.ok(res.status === 401 || res.status === 403,
        `fuzz index ${i} unexpectedly returned ${res.status}`);
    }
  });

  it('live server survives a burst of malformed raw requests without crashing', async () => {
    const server = createMockServer({ resource: RESOURCE, issuerPublicKey: ISSUER.publicKey });
    await new Promise((r) => server.listen(0, '127.0.0.1', r));
    const port = server.address().port;
    const send = (i) => new Promise((resolve) => {
      try {
        const req = http.request({ host: '127.0.0.1', port, path: '/mcp', method: 'POST',
          headers: { authorization: fuzz(i), dpop: fuzz(i + 3) } }, (res) => {
          res.resume(); res.on('end', () => resolve(res.statusCode));
        });
        req.on('error', () => resolve(-1)); req.end();
      } catch { resolve(-2); } // Node rejects control-char header values synchronously — that is
      // itself a clean rejection (the request never reaches the wire), so it counts as handled.
    });
    const statuses = await Promise.all(Array.from({ length: 50 }, (_v, i) => send(i)));
    server.close();
    assert.ok(statuses.every((s) => s === 401 || s === 403 || s === -2),
      'every malformed request got a clean rejection (401/403) or was refused before send');
  });
});

describe('stress: p99 latency budget (G7)', () => {
  it('evaluate() p99 stays under 3ms across 5000 rejections', () => {
    const seen = new Set();
    const samples = [];
    for (let i = 0; i < 5000; i += 1) {
      const req = { headers: { authorization: fuzz(i), dpop: fuzz(i + 1) } };
      const t0 = process.hrtime.bigint();
      evaluate(req, RESOURCE, ISSUER.publicKey, seen);
      samples.push(Number(process.hrtime.bigint() - t0) / 1e6);
    }
    samples.sort((a, b) => a - b);
    const p99 = samples[Math.floor(samples.length * 0.99)];
    assert.ok(p99 < 3, `evaluate p99 ${p99.toFixed(3)}ms exceeds 3ms budget`);
  });
});
