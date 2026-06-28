'use strict';
// tests/drift-detector-concepts-coverage.spec.js — Refs #3300
// tdd-pyramid: the code-drift coverage pass must credit BOTH wiki/code/symbols (scripts)
// AND wiki/code/concepts (instructions). Before #3300 it scanned symbols only, so every
// instruction source was falsely "uncovered" — capping Store A coverage at ~0.9157 and
// making the 0.95 target structurally unreachable.

const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const { detectCodeDrift } = require('../scripts/wiki/drift-detector.js');

function build() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'drift-cov-'));
  const w = (rel, body) => {
    const full = path.join(root, rel);
    fs.mkdirSync(path.dirname(full), { recursive: true });
    fs.writeFileSync(full, body);
  };
  w('scripts/global/foo.js', 'module.exports = {};\n');       // script source
  w('instructions/bar.instructions.md', '# bar\n');           // instruction source
  w('wiki/code/symbols/foo.md', '---\nsource_path: scripts/global/foo.js\n---\nstructural\n');
  w('wiki/code/concepts/bar.md', '---\nsource_path: instructions/bar.instructions.md\n---\nsemantic\n');
  const srcDirs = [
    { dir: path.join(root, 'scripts/global'), re: /\.js$/ },
    { dir: path.join(root, 'instructions'), re: /\.md$/ },
  ];
  const symbols = path.join(root, 'wiki/code/symbols');
  const concepts = path.join(root, 'wiki/code/concepts');
  return { root, srcDirs, symbols, concepts };
}

test('instruction source is covered by its concepts/ page (the #3300 fix)', () => {
  const { root, srcDirs, symbols, concepts } = build();
  const result = detectCodeDrift({ root, srcDirs, pageDirs: [symbols, concepts] });
  assert.equal(result.uncovered.length, 0,
    'both the script (symbols) and the instruction (concepts) sources should be covered: ' +
    JSON.stringify(result.uncovered));
  assert.equal(result.orphans.length, 0);
});

test('regression: symbols-only coverage falsely flags the instruction uncovered', () => {
  // Models the pre-#3300 behavior (pageDirs = symbols only).
  const { root, srcDirs, symbols } = build();
  const result = detectCodeDrift({ root, srcDirs, pageDirs: [symbols] });
  assert.equal(result.uncovered.length, 1);
  assert.match(result.uncovered[0].source, /instructions\/bar/);
});

test('a concepts/ page with no backing source is an orphan', () => {
  const { root, srcDirs, symbols, concepts } = build();
  fs.writeFileSync(path.join(concepts, 'ghost.md'),
    '---\nsource_path: instructions/does-not-exist.md\n---\nx\n');
  const result = detectCodeDrift({ root, srcDirs, pageDirs: [symbols, concepts] });
  assert.ok(result.orphans.some((o) => /concepts\/ghost\.md/.test(o.wiki)));
});
