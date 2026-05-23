'use strict';
// changelog-structure.spec.js (#2123) — Snapshot-style assertions verifying
// CHANGELOG.md conforms to Keep-a-Changelog 1.1.0 standard hierarchy after C1.
// Per Phase-0 synthesis #2121 (wiki/wisdom/project/research/changelog-aggregator-2120.md).

const fs = require('fs');
const path = require('path');
const test = require('node:test');
const assert = require('node:assert/strict');

const CHANGELOG = path.join(__dirname, '..', 'CHANGELOG.md');

function readChangelog() {
  return fs.readFileSync(CHANGELOG, 'utf8');
}

function headingLines(text) {
  const lines = text.split('\n');
  let inCode = false;
  const out = [];
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (line.startsWith('```')) { inCode = !inCode; continue; }
    if (inCode) continue;
    const m = line.match(/^(#+)\s+(.*)$/);
    if (m) out.push({ line: i + 1, level: m[1].length, text: m[2] });
  }
  return out;
}

test('CHANGELOG.md starts with H1 # Changelog title', () => {
  const text = readChangelog();
  const lines = text.split('\n');
  let firstHeading = -1;
  for (let i = 0; i < lines.length; i++) {
    if (lines[i].startsWith('#')) { firstHeading = i; break; }
  }
  assert.ok(firstHeading >= 0, 'no heading found in CHANGELOG.md');
  assert.equal(lines[firstHeading], '# Changelog', `expected first heading to be "# Changelog", got "${lines[firstHeading]}"`);
});

test('CHANGELOG.md contains exactly one H1 (the title), all other release headers are H2', () => {
  const headings = headingLines(readChangelog());
  const h1s = headings.filter(h => h.level === 1);
  assert.equal(h1s.length, 1, `expected exactly 1 H1 (the Changelog title), got ${h1s.length}: ${JSON.stringify(h1s)}`);
  assert.equal(h1s[0].text, 'Changelog');
});

test('Every bracketed-release H2 matches Keep-a-Changelog format ## [<version>]', () => {
  // C1 scope: assert that every H2 that STARTS with `[` matches the Keep-a-Changelog
  // bracket-version format. Legacy non-bracketed H2s (e.g., "## Governance",
  // "## Fixed — #1960") are pre-existing aggregator-output drift documented in
  // wiki/wisdom/project/research/changelog-aggregator-2120.md and are slated
  // for cleanup in C2 (aggregator refit).
  const headings = headingLines(readChangelog());
  const bracketed = headings.filter(h => h.level === 2 && h.text.startsWith('['));
  assert.ok(bracketed.length > 0, 'no bracketed-release H2 headers found');
  const valid = /^\[#?[\w.\-]+\](\s+.+)?$/;
  for (const h of bracketed) {
    assert.ok(valid.test(h.text), `Bracketed H2 at line ${h.line} does not match Keep-a-Changelog pattern: "${h.text}"`);
  }
});

test('No H3 appears before the first H2 (each H3 is a child of an H2 release section)', () => {
  const headings = headingLines(readChangelog());
  let firstH2 = -1;
  for (let i = 0; i < headings.length; i++) {
    if (headings[i].level === 2) { firstH2 = i; break; }
  }
  assert.ok(firstH2 >= 0, 'no H2 found');
  const h3sBefore = headings.slice(0, firstH2).filter(h => h.level === 3);
  assert.equal(h3sBefore.length, 0, `found ${h3sBefore.length} H3 header(s) before first H2: ${JSON.stringify(h3sBefore)}`);
});

test('No MD001 heading-increment skip: H1 must be followed by H2 (not H3+) before next H1', () => {
  const headings = headingLines(readChangelog());
  for (let i = 0; i < headings.length - 1; i++) {
    const curr = headings[i];
    const next = headings[i + 1];
    if (curr.level === 1 && next.level > 2) {
      assert.fail(`MD001 violation: H1 at line ${curr.line} ("${curr.text}") followed by H${next.level} at line ${next.line} ("${next.text}") — skips H2`);
    }
  }
});
