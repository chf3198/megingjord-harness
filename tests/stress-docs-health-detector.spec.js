// tests/stress-docs-health-detector.spec.js — #3298. Stress facet alongside the
// tdd-pyramid primary (the detector mutates shared state via JSONL append and parses
// in-repo doc content, so the test-floor classifier requires a stress facet — matching
// the wiki-health-detector precedent). Asserts: (G6) graceful degradation under
// fault injection — malformed config, unreadable/garbage docs, adversarial link text;
// (G7) a p99 latency budget on a large synthetic corpus.
// node:test style so the split-test-runner + collaborator preflight both run it.
'use strict';

const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const dh = require('../scripts/global/docs-health-detector');

function writeConfig(text) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'docs-health-stress-'));
  const file = path.join(dir, 'owners.yml');
  fs.writeFileSync(file, text);
  return file;
}

const validConfig = [
  'version: 1', 'surfaces:',
  '  - glob: docs/**', '    owner: collaborator', '    freshness_window: 90d',
  'orphan_exempt: []',
].join('\n');

// ── G6: fault injection — must not throw, must still classify ──

test('G6: malformed YAML config surfaces as a load error, not a silent crash', () => {
  const bad = writeConfig('version: 1\nsurfaces:\n  - glob: [unterminated');
  assert.throws(() => dh.loadOwners(bad)); // explicit failure, not a wrong-result no-op
});

test('G6: adversarial doc content (regex-bomb-ish links, huge tokens) is parsed safely', () => {
  const corpus = ['docs/a.md', 'docs/b.md'];
  const haystack = [
    { path: 'docs/a.md', text: `${'['.repeat(5000)}](${'x'.repeat(5000)}) docs/b.md [[${'z'.repeat(2000)}]]` },
    { path: 'docs/b.md', text: ' ￿ binary-ish ]]([[ unmatched' },
  ];
  const start = Date.now();
  const ref = dh.buildReferencedSet(corpus, haystack);
  assert.ok(Date.now() - start < 1000); // no catastrophic backtracking
  assert.strictEqual(ref.has('docs/b.md'), true); // bare path still resolves
});

test('G6: unreadable/empty haystack entries degrade to "everything is an orphan", never throw', () => {
  const corpus = ['docs/a.md', 'docs/b.md'];
  const { docs } = dh.scan({
    configPath: writeConfig(validConfig), corpus,
    haystack: [{ path: 'docs/a.md', text: '' }, { path: 'docs/b.md', text: null }],
    ageDaysFor: () => 1,
  });
  assert.strictEqual(docs.every((d) => d.orphan), true);
});

// ── G7: p99 latency budget on a large synthetic corpus ──

test('G7: scan of a 1000-doc corpus completes under the p99 latency budget', () => {
  const corpus = Array.from({ length: 1000 }, (_, i) => `docs/gen/doc-${i}.md`);
  // Each doc references the next, so ~all are reachable (worst-case substring scan width).
  const haystack = corpus.map((rel, i) => ({ path: rel, text: `see docs/gen/doc-${(i + 1) % 1000}.md` }));
  const latencies = [];
  for (let run = 0; run < 5; run += 1) {
    const start = Date.now();
    dh.scan({ configPath: writeConfig(validConfig), corpus, haystack, ageDaysFor: () => 1, eventsFile: path.join(os.tmpdir(), `ev-${run}.jsonl`) });
    latencies.push(Date.now() - start);
  }
  latencies.sort((a, b) => a - b);
  const p99 = latencies[latencies.length - 1];
  assert.ok(p99 < 4000, `p99 ${p99}ms exceeded 4000ms budget`); // 1000-doc full scan budget
});
