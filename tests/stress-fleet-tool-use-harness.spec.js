'use strict';
// Stress tests for the fleet tool-use harness (Epic #3414 #3487): chaos (G6) + p99 (G7).

const assert = require('node:assert/strict');
const { test } = require('node:test');
const h = require('../scripts/global/fleet-tool-use-harness.js');

function makeRng(seed) {
  let s = seed >>> 0;
  return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 0xffffffff; };
}

const SCHEMA = { required: ['tool', 'args'], properties: { tool: 'string' } };

test('chaos — 4000 adversarial model outputs never throw parseToolCall', () => {
  const rng = makeRng(0xabc);
  const frags = ['{', '}', '"tool"', ':', ',', '[]', 'null', 'garbage', '{"tool":"x","args":{}}', '```json', '\n'];
  for (let i = 0; i < 4000; i++) {
    let text = '';
    const n = Math.floor(rng() * 12);
    for (let j = 0; j < n; j++) text += frags[Math.floor(rng() * frags.length)];
    assert.doesNotThrow(() => h.parseToolCall(text, SCHEMA), `case ${i}`);
  }
});

test('perf — p99 parse budget over 5000 outputs is well under budget', () => {
  const rng = makeRng(9);
  const outs = Array.from({ length: 5000 }, (_, i) => (rng() < 0.5 ? `{"tool":"t${i}","args":{}}` : `prose ${i} {broken`));
  const timings = [];
  for (const o of outs) {
    const start = process.hrtime.bigint();
    h.parseToolCall(o, SCHEMA);
    timings.push(Number(process.hrtime.bigint() - start) / 1e6);
  }
  timings.sort((a, b) => a - b);
  assert.ok(timings[Math.floor(timings.length * 0.99)] < 5);
});
