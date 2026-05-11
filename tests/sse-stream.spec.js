// SSE stream — integration tests for multi-surface jsonl subscriber (#1354).
const { test, expect } = require('@playwright/test');
const path = require('path');
const fs = require('fs');
const os = require('os');

// Note: requiring sse-handler triggers initWatchers() with default surfaces.
// We test the exported `subscribeSurface` + `broadcast` + `clients` directly.

const settle = (ms = 300) => new Promise(resolve => setTimeout(resolve, ms));

function makeSurface() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'sse-test-'));
  const file = path.join(dir, 'test.jsonl');
  return { dir, file };
}

test('subscribeSurface: appended event triggers broadcast via mock client', async () => {
  // Mock client capturing SSE writes
  const writes = [];
  const mockRes = { write: (data) => writes.push(data) };
  // Load module fresh
  const handler = require(path.resolve(__dirname, '..', 'scripts', 'sse-handler.js'));
  handler.clients.add(mockRes);
  const { dir, file } = makeSurface();
  fs.writeFileSync(file, '');
  const handle = handler.subscribeSurface(file, 'test-event');
  await settle();
  fs.appendFileSync(file, JSON.stringify({ event: 'tick', data: 1 }) + '\n');
  await settle(500);
  handler.clients.delete(mockRes);
  handle.close();
  // SSE format: "event: <type>\ndata: <json>\n\n"
  const sseMessages = writes.filter(w => w.includes('event: tick'));
  expect(sseMessages.length).toBeGreaterThanOrEqual(1);
  expect(sseMessages[0]).toContain('"data":1');
  fs.rmSync(dir, { recursive: true });
});

test('subscribeSurface: defaults to provided event type when event field absent', async () => {
  const writes = [];
  const mockRes = { write: (data) => writes.push(data) };
  const handler = require(path.resolve(__dirname, '..', 'scripts', 'sse-handler.js'));
  handler.clients.add(mockRes);
  const { dir, file } = makeSurface();
  fs.writeFileSync(file, '');
  const handle = handler.subscribeSurface(file, 'fallback-type');
  await settle();
  fs.appendFileSync(file, JSON.stringify({ payload: 42 }) + '\n');
  await settle(500);
  handler.clients.delete(mockRes);
  handle.close();
  const sseMessages = writes.filter(w => w.includes('event: fallback-type'));
  expect(sseMessages.length).toBeGreaterThanOrEqual(1);
  fs.rmSync(dir, { recursive: true });
});

test('broadcast: sends to all connected clients', () => {
  const handler = require(path.resolve(__dirname, '..', 'scripts', 'sse-handler.js'));
  const w1 = [], w2 = [];
  const r1 = { write: (d) => w1.push(d) };
  const r2 = { write: (d) => w2.push(d) };
  handler.clients.add(r1);
  handler.clients.add(r2);
  handler.broadcast('ping', { msg: 'hi' });
  handler.clients.delete(r1);
  handler.clients.delete(r2);
  expect(w1[0]).toContain('event: ping');
  expect(w2[0]).toContain('event: ping');
});

test('broadcast: removes client whose write throws', () => {
  const handler = require(path.resolve(__dirname, '..', 'scripts', 'sse-handler.js'));
  const failing = { write: () => { throw new Error('disconnected'); } };
  handler.clients.add(failing);
  expect(handler.clients.has(failing)).toBe(true);
  handler.broadcast('test', {});
  expect(handler.clients.has(failing)).toBe(false);
});

test('tailLines: parses last N events from content', () => {
  const handler = require(path.resolve(__dirname, '..', 'scripts', 'sse-handler.js'));
  const content = JSON.stringify({ a: 1 }) + '\n' + JSON.stringify({ b: 2 }) + '\n' + JSON.stringify({ c: 3 }) + '\n';
  const events = handler.tailLines(content, 2);
  expect(events).toHaveLength(2);
  expect(events[0].b).toBe(2);
  expect(events[1].c).toBe(3);
});
