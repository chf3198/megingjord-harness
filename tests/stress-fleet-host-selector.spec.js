'use strict';
// Stress tests for the F3 host selector (Epic #3414 #3486): chaos (G6) + p99 budget (G7).

const assert = require('node:assert/strict');
const { test } = require('node:test');
const sel = require('../scripts/global/fleet-host-selector.js');

function makeRng(seed) {
  let state = seed >>> 0;
  return () => { state = (state * 1664525 + 1013904223) >>> 0; return state / 0xffffffff; };
}

function chaosMesh(rng) {
  const n = Math.floor(rng() * 8);
  return Array.from({ length: n }, (_, i) => ({
    id: rng() < 0.1 ? undefined : `h${i}`,
    reachable: rng() < 0.6,
    ps: rng() < 0.2 ? 'garbage' : Array.from({ length: Math.floor(rng() * 6) }, () => 1),
    gpu: rng() < 0.3 ? undefined : { vramFreeMb: rng() < 0.2 ? 'x' : Math.floor(rng() * 48000) },
  }));
}

test('chaos — 3000 adversarial meshes never throw; result is a reachable host or null', () => {
  const rng = makeRng(0xc0ffee);
  for (let i = 0; i < 3000; i++) {
    const mesh = chaosMesh(rng);
    let out;
    assert.doesNotThrow(() => { out = sel.resolveHostPosture(mesh); }, `case ${i}`);
    assert.ok(['F0', 'F2', 'F3'].includes(out.tier));
    if (out.host) assert.equal(out.host.reachable, true);
  }
});

test('perf — p99 selection budget over 5000 meshes is well under budget', () => {
  const rng = makeRng(3);
  const meshes = Array.from({ length: 5000 }, () => chaosMesh(rng));
  const timings = [];
  for (const mesh of meshes) {
    const start = process.hrtime.bigint();
    sel.resolveHostPosture(mesh);
    timings.push(Number(process.hrtime.bigint() - start) / 1e6);
  }
  timings.sort((a, b) => a - b);
  assert.ok(timings[Math.floor(timings.length * 0.99)] < 5);
});
