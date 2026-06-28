'use strict';
// tests/prose-link-check.spec.js — Refs #3297
// tdd-pyramid: unit cases over temp fixtures + one real-tree regression guard (AC2).

const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const mod = require('../scripts/global/megalint/prose-link-check.js');
const { validate, lintFile, isExternalOrAnchor, barePath, isExcluded } = mod;

function tmpRoot() { return fs.mkdtempSync(path.join(os.tmpdir(), 'prose-link-')); }
function writeFile(root, rel, content) {
  const full = path.join(root, rel);
  fs.mkdirSync(path.dirname(full), { recursive: true });
  fs.writeFileSync(full, content);
  return full;
}

test('flags a broken relative .md link', () => {
  const root = tmpRoot();
  const f = writeFile(root, 'docs/a.md', '# A\n\nSee [gone](./missing.md).');
  const out = lintFile(f, { repoRoot: root });
  assert.equal(out.filter(x => x.rule === 'broken-prose-link').length, 1);
});

test('resolvable relative .md link passes', () => {
  const root = tmpRoot();
  writeFile(root, 'docs/b.md', '# B');
  const f = writeFile(root, 'docs/a.md', '# A\n\nSee [b](./b.md).');
  assert.equal(lintFile(f, { repoRoot: root }).length, 0);
});

test('relative .md link up a directory resolves', () => {
  const root = tmpRoot();
  writeFile(root, 'instructions/x.instructions.md', '# x');
  const f = writeFile(root, 'research/r.md', '# R\n\n[x](../instructions/x.instructions.md)');
  assert.equal(lintFile(f, { repoRoot: root }).length, 0);
});

test('external links and pure anchors are skipped', () => {
  for (const t of ['https://x.com', 'http://x', 'mailto:a@b.c', '#sec', 'tel:1', 'data:x']) {
    assert.equal(isExternalOrAnchor(t), true, t);
  }
  assert.equal(isExternalOrAnchor('./rel.md'), false);
});

test('non-.md relative targets are out of scope (not flagged)', () => {
  const root = tmpRoot();
  const f = writeFile(root, 'docs/a.md', '# A\n\n[img](./missing.png) [code](./missing.js)');
  assert.equal(lintFile(f, { repoRoot: root }).length, 0);
});

test('#fragment and ?query suffixes are stripped before resolution', () => {
  const root = tmpRoot();
  writeFile(root, 'docs/b.md', '# B');
  const f = writeFile(root, 'docs/a.md', '# A\n\n[b](./b.md#heading) [b2](./b.md?x=1)');
  assert.equal(lintFile(f, { repoRoot: root }).length, 0);
  assert.equal(barePath('./b.md#heading'), './b.md');
  assert.equal(barePath('./b.md?x=1'), './b.md');
});

test('auto-generated wiki mirrors are excluded from the scan', () => {
  const root = tmpRoot();
  // a broken link inside wiki/work-log must NOT be reported (pipeline-owned)
  writeFile(root, 'wiki/work-log/tickets/1.md', '# t\n\n[gone](./nope.md)');
  writeFile(root, 'wiki/code/symbols/s.md', '# s\n\n[gone](./nope.md)');
  // a broken link inside wiki/wisdom IS in scope
  const wisdom = writeFile(root, 'wiki/wisdom/global/w.md', '# w\n\n[gone](./nope.md)');
  assert.equal(isExcluded('wiki/work-log/tickets/1.md'), true);
  assert.equal(isExcluded('wiki/code/symbols/s.md'), true);
  assert.equal(isExcluded('wiki/wisdom/global/w.md'), false);
  const { findings } = validate([], { repoRoot: root });
  assert.equal(findings.length, 1);
  assert.equal(findings[0].file, 'wiki/wisdom/global/w.md');
});

test('validate() reports ok on a clean fixture set', () => {
  const root = tmpRoot();
  writeFile(root, 'docs/b.md', '# B');
  writeFile(root, 'docs/a.md', '# A\n\n[b](./b.md) and [ext](https://x.com)');
  assert.equal(validate([], { repoRoot: root }).ok, true);
});

test('AC2 regression: the real repo prose tree has no broken relative .md links', () => {
  const repoRoot = path.join(__dirname, '..');
  const { ok, findings } = validate([], { repoRoot });
  assert.equal(ok, true,
    'prose-link-check found broken links in the tree:\n' +
    findings.map(f => `${f.file}:${f.line} -> ${f.detail}`).join('\n'));
});
