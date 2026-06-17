// tests/wiki-mirror-issue.spec.js — golden-file + behavior tests for the live
// single-issue Wiki B mirror (#3066, Epic #3063). Strategy: golden-file (+stress in
// tests/stress-wiki-mirror-issue.spec.js).
'use strict';

const { test, expect } = require('@playwright/test');
const fs = require('fs');
const os = require('os');
const path = require('path');
const matter = require('gray-matter');

const { mirrorIssue } = require('../scripts/wiki/mirror-issue');
const { buildPage } = require('../scripts/wiki/backfill-work-log');

const LABELED = {
  number: 1234, title: 'Sample labeled issue for mirror golden', state: 'OPEN',
  body: 'Issue body for the mirror golden.\nPing ops@example.com if blocked.',
  labels: [{ name: 'type:task' }, { name: 'status:in-progress' }, { name: 'area:knowledge' }],
};

function tmpDir() { return fs.mkdtempSync(path.join(os.tmpdir(), 'mirror-')); }

test('golden-file: a labeled-event payload renders byte-identical to the committed golden', () => {
  const golden = fs.readFileSync(
    path.join(__dirname, 'fixtures', 'wiki-mirror', 'golden-issue-1234.md'), 'utf8');
  const { page } = buildPage(LABELED, 'issue', 'mirror-run-1', '2026-01-01');
  expect(page).toBe(golden);
});

test('mirrorIssue writes wiki/work-log/tickets/<N>.md with valid provenance frontmatter', () => {
  const dir = tmpDir();
  const res = mirrorIssue(1234, { item: LABELED, ticketsDir: dir, runId: 'r1', today: '2026-01-01' });
  expect(res.changed).toBe(true);
  const written = fs.readFileSync(path.join(dir, '1234.md'), 'utf8');
  const fm = matter(written).data;
  for (const field of ['source_path', 'source_sha256', 'content_hash', 'generated_by_run', 'type']) {
    expect(fm[field]).toBeTruthy();
  }
  expect(fm.type).toBe('work-log');
  expect(written).not.toContain('ops@example.com'); // redaction applied
});

test('idempotent: re-run on unchanged source is a no-op even with a different run id/date', () => {
  const dir = tmpDir();
  const first = mirrorIssue(1234, { item: LABELED, ticketsDir: dir, runId: 'run-A', today: '2026-01-01' });
  const again = mirrorIssue(1234, { item: LABELED, ticketsDir: dir, runId: 'run-B', today: '2026-09-09' });
  expect(first.changed).toBe(true);
  expect(again.changed).toBe(false);
  expect(again.reason).toBe('unchanged');
});

test('changed source triggers a rewrite', () => {
  const dir = tmpDir();
  mirrorIssue(1234, { item: LABELED, ticketsDir: dir, runId: 'r1', today: '2026-01-01' });
  const edited = { ...LABELED, body: 'Edited body after a label event.' };
  const res = mirrorIssue(1234, { item: edited, ticketsDir: dir, runId: 'r2', today: '2026-01-01' });
  expect(res.changed).toBe(true);
});

test('rejects a non-positive-integer issue number (path-traversal guard)', () => {
  const dir = tmpDir();
  expect(() => mirrorIssue('../evil', { item: LABELED, ticketsDir: dir })).toThrow(/invalid issue number/);
});
