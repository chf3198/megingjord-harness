// tests/wiki-ingest-code.spec.js — Wiki A ingest-code + invisible-char scan tests
// test_strategy: tdd-pyramid  Refs #2053
'use strict';

const { test, expect } = require('@playwright/test');
const path = require('path');
const os = require('os');
const fs = require('fs');
const matter = require('gray-matter');
const { scanContent, scanFile, INVISIBLE_CHARS } = require('../scripts/wiki/invisible-char-scan');
const { ingestCode, computeTrustScore, toSlug, countCrossRefs } = require('../scripts/wiki/ingest-code');

const FIX = path.join(__dirname, 'fixtures/wiki-ingest');

// ── invisible-char-scan: clean file ─────────────────────────────────────────
test('scanFile: clean fixture returns 0 findings', () => {
  const findings = scanFile(path.join(FIX, 'clean.js'));
  expect(findings).toHaveLength(0);
});

// ── invisible-char-scan: ZWJ fixture (HIGH) ──────────────────────────────────
test('scanFile: with-zwj.js flags HIGH ZWJ finding', () => {
  const findings = scanFile(path.join(FIX, 'with-zwj.js'));
  expect(findings.length).toBeGreaterThan(0);
  expect(findings.some((f) => f.codepoint === 'U+200D')).toBe(true);
  expect(findings.some((f) => f.severity === 'HIGH')).toBe(true);
});

// ── invisible-char-scan: ZWSP fixture (HIGH) ─────────────────────────────────
test('scanFile: with-zwsp.md flags HIGH ZWSP finding', () => {
  const findings = scanFile(path.join(FIX, 'with-zwsp.md'));
  expect(findings.some((f) => f.codepoint === 'U+200B')).toBe(true);
  expect(findings.some((f) => f.severity === 'HIGH')).toBe(true);
});

// ── invisible-char-scan: BOM at position 0 is LOW ────────────────────────────
test('scanFile: with-bom.js BOM at byte 0 is LOW severity', () => {
  const findings = scanFile(path.join(FIX, 'with-bom.js'));
  const bomFindings = findings.filter((f) => f.codepoint === 'U+FEFF');
  expect(bomFindings.length).toBeGreaterThan(0);
  expect(bomFindings.every((f) => f.severity === 'LOW')).toBe(true);
});

// ── invisible-char-scan: finding structure is correct ─────────────────────────
test('scanContent: finding has required fields (path, line, col, codepoint, name, severity)', () => {
  const findings = scanFile(path.join(FIX, 'with-zwj.js'));
  const f = findings[0];
  expect(typeof f.path).toBe('string');
  expect(typeof f.line).toBe('number');
  expect(typeof f.col).toBe('number');
  expect(f.codepoint).toMatch(/^U\+[0-9A-F]{4,6}$/);
  expect(typeof f.name).toBe('string');
  expect(['HIGH', 'MEDIUM', 'LOW']).toContain(f.severity);
});

// ── invisible-char-scan: ZWSP in middle (HIGH) ───────────────────────────────
test('scanContent: inline ZWSP string returns HIGH finding', () => {
  const zwsp = String.fromCodePoint(0x200B);
  const findings = scanContent('test.js', `const x = ${zwsp}1;`);
  expect(findings.some((f) => f.severity === 'HIGH')).toBe(true);
});

// ── computeTrustScore bounds ──────────────────────────────────────────────────
test('computeTrustScore: score is bounded [0, 1]', () => {
  const score = computeTrustScore({ hasTests: true, crossRefs: 10, invisible: [] });
  expect(score).toBeGreaterThanOrEqual(0);
  expect(score).toBeLessThanOrEqual(1);
});

test('computeTrustScore: HIGH invisible char degrades score', () => {
  const base = computeTrustScore({ hasTests: false, crossRefs: 0, invisible: [] });
  const degraded = computeTrustScore({
    hasTests: false, crossRefs: 0,
    invisible: [{ severity: 'HIGH' }],
  });
  expect(degraded).toBeLessThan(base);
});

test('computeTrustScore: test coverage increases score', () => {
  const no = computeTrustScore({ hasTests: false, crossRefs: 0, invisible: [] });
  const yes = computeTrustScore({ hasTests: true, crossRefs: 0, invisible: [] });
  expect(yes).toBeGreaterThan(no);
});

// ── ingestCode: produces valid frontmatter ────────────────────────────────────
test('ingestCode: produces wiki/code pages with valid frontmatter', () => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'wiki-ingest-'));
  const results = ingestCode({ wikiCodeDir: tmpDir, dryRun: false });
  expect(results.length).toBeGreaterThan(0);
  for (const r of results) {
    expect(r.status).toBe('ok');
    const raw = fs.readFileSync(r.outPath, 'utf-8');
    const { data: fm } = matter(raw);
    expect(fm.title).toBeTruthy();
    expect(fm.type).toBe('code');
    expect(typeof fm.content_trust_score).toBe('number');
    expect(fm.content_trust_score).toBeGreaterThanOrEqual(0);
    expect(fm.content_trust_score).toBeLessThanOrEqual(1);
  }
  fs.rmSync(tmpDir, { recursive: true });
});

// ── toSlug and countCrossRefs ──────────────────────────────────────────────────
test('toSlug: derives slug from file path', () => {
  expect(toSlug('/a/b/my-script.js')).toBe('my-script');
});

test('countCrossRefs: counts Refs and wikilinks', () => {
  expect(countCrossRefs('Refs #123 and [[agent-signature]]')).toBe(2);
  expect(countCrossRefs('no refs here')).toBe(0);
});
