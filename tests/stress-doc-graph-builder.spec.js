// Refs #2168 — stress test suite for doc-graph-builder (#2153)
// G6 fault-injection paths + G7 p99 latency budget + deterministic-rebuild stress
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');

const { buildGraph, extractWikilinks } = require('../scripts/global/doc-graph-builder.js');

function mkSandbox(prefix) {
  return fs.mkdtempSync(path.join(os.tmpdir(), `stress-doc-graph-${prefix}-`));
}

function p99(samples) {
  const sorted = [...samples].sort((a, b) => a - b);
  return sorted[Math.floor(sorted.length * 0.99)] || sorted[sorted.length - 1];
}

test('chaos G6: adversarial wikilink input — deeply-nested brackets do not hang', () => {
  const malicious = '[' .repeat(1000) + '[real]]' + ']'.repeat(1000);
  const start = Date.now();
  const links = extractWikilinks(malicious);
  assert.ok(Date.now() - start < 100, 'extract took >100ms — possible ReDoS');
  assert.ok(links.includes('real'));
});

test('chaos G6: oversized single-file input parses without OOM', () => {
  const sb = mkSandbox('oversized');
  fs.mkdirSync(path.join(sb, 'docs'), { recursive: true });
  // 5MB of mixed content with sparse wikilinks
  let content = '';
  for (let i = 0; i < 50000; i++) content += `line ${i} [[link-${i % 100}]] padding xxxxxxxxxxxxxxxxxxxx\n`;
  fs.writeFileSync(path.join(sb, 'docs', 'oversized.md'), content);
  const start = Date.now();
  const graph = buildGraph(sb);
  const elapsed = Date.now() - start;
  assert.ok(elapsed < 2000, `oversized parse took ${elapsed}ms (>2s)`);
  assert.ok(graph.edges.length >= 100);
  fs.rmSync(sb, { recursive: true, force: true });
});

test('chaos G6: regex-backtracking probe — repetition pattern is bounded', () => {
  // Pattern designed to trip catastrophic backtracking on naive regex
  const probe = '[[' + 'a'.repeat(50000) + '\n';
  const start = Date.now();
  const links = extractWikilinks(probe);
  const elapsed = Date.now() - start;
  assert.ok(elapsed < 200, `regex took ${elapsed}ms on backtracking probe`);
  assert.equal(links.length, 0, 'unterminated wikilink should not match');
});

test('G7 p99 latency budget: build graph across 500-file sandbox completes <500ms p99', () => {
  const sb = mkSandbox('p99');
  fs.mkdirSync(path.join(sb, 'docs'), { recursive: true });
  for (let i = 0; i < 500; i++) {
    fs.writeFileSync(path.join(sb, 'docs', `f${i}.md`), `[[link-${i}]] [[shared-${i % 10}]]`);
  }
  const samples = [];
  for (let i = 0; i < 10; i++) {
    const start = process.hrtime.bigint();
    buildGraph(sb);
    samples.push(Number(process.hrtime.bigint() - start) / 1e6);
  }
  const p99Val = p99(samples);
  assert.ok(p99Val < 500, `p99 = ${p99Val.toFixed(1)}ms > 500ms budget`);
  fs.rmSync(sb, { recursive: true, force: true });
});

test('determinism stress: 100 sequential rebuilds yield byte-identical output', () => {
  const sb = mkSandbox('determinism');
  fs.mkdirSync(path.join(sb, 'docs'), { recursive: true });
  for (let i = 0; i < 20; i++) {
    fs.writeFileSync(path.join(sb, 'docs', `f${i}.md`), `[[a-${i}]] [[b-${i % 3}]] [[c-${i % 5}]]`);
  }
  const baseline = JSON.stringify(buildGraph(sb));
  for (let i = 0; i < 100; i++) {
    const next = JSON.stringify(buildGraph(sb));
    assert.equal(next, baseline, `rebuild #${i} diverged from baseline`);
  }
  fs.rmSync(sb, { recursive: true, force: true });
});

test('chaos G6: empty + missing directories return empty graph', () => {
  const sb = mkSandbox('empty');
  const graph = buildGraph(sb);
  assert.equal(graph.nodes.length, 0);
  assert.equal(graph.edges.length, 0);
  fs.rmSync(sb, { recursive: true, force: true });
});
