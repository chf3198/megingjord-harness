'use strict';
// fleet-call-guard.spec.js — Refs #2626.
// Tests: success, timeout, retry-success, retry_exhaustion, FLEET_GUARD_DISABLED.
// Uses inline http.createServer() to avoid external dependencies (G10/G3).
const test = require('node:test');
const assert = require('node:assert/strict');
const http = require('node:http');
const { callWithGuard } = require('../scripts/global/fleet-call-guard.js');

let BASE_PORT = 29800;
function nextPort() { return BASE_PORT++; }

function startServer(handler) {
  const port = nextPort();
  return new Promise((resolve) => {
    const server = http.createServer(handler);
    server.listen(port, () => resolve({ server, port }));
  });
}

test('success: result.success true, elapsed_ms present', async () => {
  const { server, port } = await startServer((req, res) => {
    let b = '';
    req.on('data', c => { b += c; });
    req.on('end', () => {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ response: 'hello' }));
    });
  });
  const result = await callWithGuard({ host: `http://localhost:${port}`, prompt: 'hi', timeout: 2000, maxRetries: 0 });
  server.close();
  assert.strictEqual(result.success, true);
  assert.ok(typeof result.elapsed_ms === 'number' && result.elapsed_ms >= 0);
});

test('timeout: reason=timeout, fallback_tier=free-cloud', async () => {
  // Server never responds — triggers timeout
  const { server, port } = await startServer((_req, _res) => {});
  const result = await callWithGuard({ host: `http://localhost:${port}`, prompt: 'hi', timeout: 150, maxRetries: 0 });
  server.close();
  assert.strictEqual(result.success, false);
  assert.strictEqual(result.reason, 'timeout');
  assert.strictEqual(result.fallback_tier, 'free-cloud');
});

test('retry success: succeeds on second attempt', async () => {
  let calls = 0;
  const port = nextPort();
  await new Promise((resolve) => {
    const server = http.createServer((req, res) => {
      calls++;
      if (calls === 1) { req.socket.destroy(); return; }
      let b = '';
      req.on('data', c => { b += c; });
      req.on('end', () => {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ response: 'ok' }));
      });
    });
    server.listen(port, () => resolve(server));
  }).then(server => {
    return callWithGuard({ host: `http://localhost:${port}`, prompt: 'hi', timeout: 2000, maxRetries: 1 })
      .then(result => { server.close(); assert.strictEqual(result.success, true); });
  });
});

test('retry_exhaustion: reason=retry_exhaustion, attempts=maxRetries', async () => {
  const { server, port } = await startServer((req, _res) => { req.socket.destroy(); });
  const result = await callWithGuard({ host: `http://localhost:${port}`, prompt: 'hi', timeout: 2000, maxRetries: 1 });
  server.close();
  assert.strictEqual(result.success, false);
  assert.strictEqual(result.reason, 'retry_exhaustion');
  assert.strictEqual(result.attempts, 1);
  assert.strictEqual(result.fallback_tier, 'free-cloud');
});

test('FLEET_GUARD_DISABLED=1: guard bypassed, call passes through', async () => {
  const { server, port } = await startServer((req, res) => {
    let b = '';
    req.on('data', c => { b += c; });
    req.on('end', () => {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ response: 'bypass' }));
    });
  });
  process.env.FLEET_GUARD_DISABLED = '1';
  const result = await callWithGuard({ host: `http://localhost:${port}`, prompt: 'hi', timeout: 50 });
  delete process.env.FLEET_GUARD_DISABLED;
  server.close();
  assert.strictEqual(result.success, true);
});
