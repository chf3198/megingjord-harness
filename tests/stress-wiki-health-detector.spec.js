// tests/stress-wiki-health-detector.spec.js — #3068 stress arm of tdd-pyramid+stress-test.
// The detector parses untrusted wiki frontmatter (adversarial-input surface); assert a
// fault-injection path (G6) AND a p99 latency budget (G7) per the matrix stress contract.
'use strict';

const { test, expect } = require('@playwright/test');
const fs = require('fs');
const os = require('os');
const path = require('path');
const wh = require('../scripts/wiki/wiki-health-detector');

function mkRaw(dir, name, raw) { fs.writeFileSync(path.join(dir, name), raw); }

// ── fault injection (G6): malformed entries never crash the detector ──

test('stress: malformed / hostile work-log entries degrade gracefully, never throw', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'wh-stress-'));
  mkRaw(dir, '0.md', '---\nnot: [valid, yaml\n---\nbody');        // broken YAML
  mkRaw(dir, '1.md', 'no frontmatter at all');                    // no fence
  mkRaw(dir, '2.md', '---\nlast_updated: "not-a-date"\ntype: work-log\nsource_path: x\n---\n');
  mkRaw(dir, '3.md', `---\ntype: work-log\nlast_updated: ${'9'.repeat(400)}\nsource_path: x\n---\n`);
  mkRaw(dir, 'README.md', 'should be skipped');
  expect(() => wh.computeStoreHealth('B', { wlDirs: [dir] })).not.toThrow();
  const health = wh.computeStoreHealth('B', { wlDirs: [dir] });
  expect(health.entry_count).toBe(4); // README excluded
  expect(Number.isFinite(health.coverage_ratio)).toBe(true);
});

test('stress: classify + promotionDecision never throw on garbage input', () => {
  expect(() => wh.classify({})).not.toThrow();
  expect(() => wh.promotionDecision('nan')).not.toThrow();
  expect(() => wh.run({ wlDirs: [], bSourceCount: 0, eventsFile: path.join(os.tmpdir(), `wh-${process.pid}.jsonl`) })).not.toThrow();
});

// ── perf budget (G7): bounded latency over a large store ──

test('stress: computeStoreHealth(B) over a 2000-entry store stays under a p99 budget', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'wh-perf-'));
  for (let index = 0; index < 2000; index += 1) {
    fs.writeFileSync(path.join(dir, `${index}.md`), `---\ntype: work-log\nlast_updated: "2026-06-18"\nsource_path: "github:issue/${index}"\n---\nbody\n`);
  }
  const samples = [];
  for (let iteration = 0; iteration < 10; iteration += 1) {
    const start = process.hrtime.bigint();
    wh.computeStoreHealth('B', { wlDirs: [dir] });
    samples.push(Number(process.hrtime.bigint() - start) / 1e6);
  }
  samples.sort((first, second) => first - second);
  const p99 = samples[Math.floor(samples.length * 0.99)];
  expect(p99, `p99 ${p99.toFixed(1)}ms exceeded 2000ms for 2000 entries`).toBeLessThan(2000);
});
