// tests/wiki-backfill-work-log.spec.js — AC3 validate-at-write + golden-file parity for
// the Wiki A/B governed backfill (#3065, Epic #3063). Strategy: tdd-pyramid+golden-file.
'use strict';

const { test, expect } = require('@playwright/test');
const fs = require('fs');
const os = require('os');
const path = require('path');
const matter = require('gray-matter');

const {
  backfillWorkLog, buildPage, assertEntryValid, PROVENANCE_FIELDS,
} = require('../scripts/wiki/backfill-work-log');
const { computeTrustScore, ingestCode } = require('../scripts/wiki/ingest-code');

const SAMPLE = {
  number: 42, title: 'Sample ticket for golden-file parity', state: 'OPEN',
  body: 'Body line one.\nReach me at user@example.com for details.',
  labels: [{ name: 'type:task' }, { name: 'area:knowledge' }],
};

test('buildPage emits all five provenance frontmatter fields + schema fields', () => {
  const { page } = buildPage(SAMPLE, 'issue', 'test-run-1', '2026-01-01');
  const { data } = matter(page);
  for (const field of [...PROVENANCE_FIELDS, 'title', 'type', 'content_trust_score', 'created', 'updated']) {
    expect(data[field], `missing ${field}`).not.toBe(undefined);
    expect(data[field], `empty ${field}`).not.toBe('');
  }
  expect(data.type).toBe('work-log');
});

test('buildPage applies log-redaction to bodies (email never written raw)', () => {
  const { page } = buildPage(SAMPLE, 'issue', 'test-run-1', '2026-01-01');
  expect(/user@example\.com/.test(page)).toBeFalsy();
  expect(/<HASH:/.test(page)).toBeTruthy();
});

test('golden-file parity — buildPage output is byte-identical to the committed golden', () => {
  const golden = fs.readFileSync(
    path.join(__dirname, 'fixtures', 'wiki-backfill', 'golden-ticket-42.md'), 'utf8');
  const { page } = buildPage(SAMPLE, 'issue', 'test-run-1', '2026-01-01');
  expect(page).toBe(golden);
});

test('assertEntryValid throws when a provenance field is stripped (validate-at-write abort)', () => {
  const { page, sourceSha } = buildPage(SAMPLE, 'issue', 'test-run-1', '2026-01-01');
  const broken = page.replace(/source_path:.*\n/, '');
  expect(() => assertEntryValid(SAMPLE, broken, sourceSha)).toThrow(/source_path/);
});

test('assertEntryValid throws on source_sha256 parity mismatch', () => {
  const { page } = buildPage(SAMPLE, 'issue', 'test-run-1', '2026-01-01');
  expect(() => assertEntryValid(SAMPLE, page, 'deadbeef')).toThrow(/parity mismatch/);
});

test('assertEntryValid throws when the body is tampered (content_hash parity)', () => {
  const { page, sourceSha } = buildPage(SAMPLE, 'issue', 'test-run-1', '2026-01-01');
  const tampered = page.replace('## Body', '## Body\n\nINJECTED LINE');
  expect(() => assertEntryValid(SAMPLE, tampered, sourceSha)).toThrow(/content_hash parity/);
});

test('backfillWorkLog dry-run writes no files and surfaces source counts', () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'wlog-'));
  // gh may be absent/empty in CI -> empty source arrays (G6 graceful); 0 writes either way.
  const result = backfillWorkLog({ dryRun: true, workLogDir: tmp });
  expect(result.tickets && result.prs && result.sourceCounts).toBeTruthy();
  const ticketsDir = path.join(tmp, 'tickets');
  const wrote = fs.existsSync(ticketsDir) ? fs.readdirSync(ticketsDir) : [];
  expect(wrote.length).toBe(0);
});

test('backfillWorkLog dry-run skips items with a non-integer number (path-traversal guard)', () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'wlog-guard-'));
  const result = backfillWorkLog({
    dryRun: true, workLogDir: tmp,
    items: { tickets: [{ number: '../evil', title: 'x', body: '', labels: [] }], prs: [] },
  });
  // injected bad item must not be counted as written (guard skips it)
  expect(result.tickets.written.includes('../evil')).toBeFalsy();
});

// ── ingest-code.js regression: the `s is not defined` crash (root cause of empty Wiki A) ──

test('computeTrustScore no longer throws and returns a bounded [0,1] score', () => {
  const score = computeTrustScore({ hasTests: true, crossRefs: 2, invisible: [] });
  expect(typeof score).toBe('number');
  expect(score >= 0 && score <= 1).toBeTruthy();
});

test('computeTrustScore handles MEDIUM invisible-char path without ReferenceError', () => {
  const score = computeTrustScore({ hasTests: false, crossRefs: 0, invisible: [{ severity: 'MEDIUM' }] });
  expect(score >= 0 && score <= 1).toBeTruthy();
});

test('ingestCode routes scripts to symbols/ and instructions to concepts/ (dry-run)', () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'wcode-'));
  const results = ingestCode({ dryRun: true, wikiCodeDir: tmp, runId: 'test' });
  expect(results.length > 0).toBeTruthy();
  expect(results.some((r) => r.subdir === 'symbols')).toBeTruthy();
  expect(results.some((r) => r.subdir === 'concepts')).toBeTruthy();
});
