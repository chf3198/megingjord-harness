// tests/wiki-reconcile.spec.js — unit tests for the daily local-first reconciliation +
// Tier-0 archive (#3067, Epic #3063). Strategy: tdd-pyramid (+stress in
// tests/stress-wiki-reconcile.spec.js).
'use strict';

const { test, expect } = require('@playwright/test');
const fs = require('fs');
const os = require('os');
const path = require('path');
const crypto = require('crypto');
const { execFileSync } = require('child_process');

const reconcile = require('../scripts/wiki/reconcile');
const archive = require('../scripts/wiki/archive-snapshot');
const { buildPage } = require('../scripts/wiki/backfill-work-log');

const sha = (t) => crypto.createHash('sha256').update(t).digest('hex');
const tmp = (p) => fs.mkdtempSync(path.join(os.tmpdir(), p));
const ROOT = path.join(__dirname, '..');

function writeTicket(dir, item, runId = 'r', day = '2026-01-01') {
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, `${item.number}.md`), buildPage(item, 'issue', runId, day).page);
}

// ── Wiki A reconcile (local git, no network) ──

test('reconcileA flags a page whose source_sha256 no longer matches git HEAD', () => {
  const dir = tmp('recA-'); const sub = path.join(dir, 'symbols');
  fs.mkdirSync(sub, { recursive: true });
  // A real committed file as the source, but a deliberately wrong recorded sha.
  const page = ['---', 'title: x', 'type: code', 'content_trust_score: 0.5',
    'created: "2026-01-01"', 'updated: "2026-01-01"',
    'source_path: "package.json"', 'source_sha256: deadbeef', '---', '', '# x', ''].join('\n');
  fs.writeFileSync(path.join(sub, 'pkg.md'), page);
  const res = reconcile.reconcileA({ codeDir: dir, dryRun: true });
  expect(res.drifted).toContain('package.json');
});

test('reconcileA does not flag a page whose source_sha256 matches git HEAD', () => {
  const dir = tmp('recA2-'); const sub = path.join(dir, 'symbols');
  fs.mkdirSync(sub, { recursive: true });
  const headSha = sha(execFileSync('git', ['show', 'HEAD:package.json'], { cwd: ROOT, encoding: 'utf8' }));
  const page = ['---', 'title: x', 'type: code', 'content_trust_score: 0.5',
    'created: "2026-01-01"', 'updated: "2026-01-01"',
    'source_path: "package.json"', `source_sha256: ${headSha}`, '---', '', '# x', ''].join('\n');
  fs.writeFileSync(path.join(sub, 'pkg.md'), page);
  const res = reconcile.reconcileA({ codeDir: dir, dryRun: true });
  expect(res.drifted).not.toContain('package.json');
});

test('reconcileA flags (does not silently pass) a page whose source_path escapes the repo', () => {
  const dir = tmp('recA3-'); const sub = path.join(dir, 'symbols');
  fs.mkdirSync(sub, { recursive: true });
  const page = ['---', 'title: x', 'type: code', 'content_trust_score: 0.5',
    'created: "2026-01-01"', 'updated: "2026-01-01"',
    'source_path: "../../etc/passwd"', 'source_sha256: abc', '---', '', '# x', ''].join('\n');
  fs.writeFileSync(path.join(sub, 'evil.md'), page);
  const res = reconcile.reconcileA({ codeDir: dir, dryRun: true });
  // traversal path is rejected by the guard -> treated as drift (source unresolvable), never a silent pass
  expect(res.drifted).toContain('../../etc/passwd');
});

// ── Wiki B reconcile + cache ladder (AC1/AC2) ──

test('reconcileB: gh reachable + matching source = no drift, no cache', () => {
  const dir = tmp('recB-'); const item = { number: 7, title: 't', state: 'OPEN', body: 'b', labels: [] };
  writeTicket(dir, item);
  const res = reconcile.reconcileB({ ticketsDir: dir, cacheFile: path.join(dir, 'c.json'), dryRun: true, fetchIssue: () => item });
  expect(res.drifted.length).toBe(0);
  expect(res.cacheUsed).toBe(0);
});

test('reconcileB: gh unreachable + fresh cache = Tier-1, cache_used counted', () => {
  const dir = tmp('recB1-'); const item = { number: 7, title: 't', state: 'OPEN', body: 'b', labels: [] };
  writeTicket(dir, item);
  const cacheFile = path.join(dir, 'c.json');
  reconcile.writeCache(cacheFile, { 7: sha(JSON.stringify(item)) });
  const res = reconcile.reconcileB({
    ticketsDir: dir, cacheFile, dryRun: true, fetchIssue: () => { throw new Error('gh down'); },
  });
  expect(res.tier).toBe('tier-1');
  expect(res.cacheUsed).toBe(1);
});

test('reconcileB: gh unreachable + stale cache (over 24h) = Tier-2', () => {
  const dir = tmp('recB2-'); const item = { number: 7, title: 't', state: 'OPEN', body: 'b', labels: [] };
  writeTicket(dir, item);
  const cacheFile = path.join(dir, 'c.json');
  const entries = { 7: sha(JSON.stringify(item)) };
  const old = new Date(Date.now() - 30 * 60 * 60 * 1000).toISOString();
  fs.writeFileSync(cacheFile, JSON.stringify({ generated_at: old, entries, checksum: sha(JSON.stringify(entries)) }));
  const res = reconcile.reconcileB({
    ticketsDir: dir, cacheFile, dryRun: true, fetchIssue: () => { throw new Error('gh down'); },
  });
  expect(res.tier).toBe('tier-2');
});

test('reconcileB: gh unreachable + no cache = Tier-2 (never silent)', () => {
  const dir = tmp('recB3-'); const item = { number: 7, title: 't', state: 'OPEN', body: 'b', labels: [] };
  writeTicket(dir, item);
  const res = reconcile.reconcileB({
    ticketsDir: dir, cacheFile: path.join(dir, 'missing.json'), dryRun: true,
    fetchIssue: () => { throw new Error('gh down'); },
  });
  expect(res.tier).toBe('tier-2');
  expect(res.drifted).toContain(7);
});

test('readCache rejects a tampered cache (checksum mismatch)', () => {
  const dir = tmp('cache-'); const cacheFile = path.join(dir, 'c.json');
  reconcile.writeCache(cacheFile, { 1: 'abc' });
  const obj = JSON.parse(fs.readFileSync(cacheFile, 'utf8'));
  obj.entries['1'] = 'tampered';
  fs.writeFileSync(cacheFile, JSON.stringify(obj));
  expect(reconcile.readCache(cacheFile)).toBe(null);
});

// ── Tier-0 archive (AC4) ──

test('buildManifest + verifySnapshot roundtrip; tampered archive fails verification', () => {
  const zip = Buffer.from('PK-fake-archive-bytes');
  const manifest = archive.buildManifest(zip, { generatedAt: '2026-01-01T00:00:00Z' });
  expect(manifest.algorithm).toBe('ed25519');
  expect(archive.verifySnapshot(zip, manifest)).toBe(true);
  expect(archive.verifySnapshot(Buffer.concat([zip, Buffer.from('!')]), manifest)).toBe(false);
});

test('snapshot writes a signed manifest using an injected zip builder (no zip CLI needed)', () => {
  const dir = tmp('arch-');
  const res = archive.snapshot({
    staticDir: dir,
    zipBuilder: (zipPath) => fs.writeFileSync(zipPath, Buffer.from('fake-zip-content')),
  });
  expect(fs.existsSync(res.zipPath)).toBe(true);
  const manifest = JSON.parse(fs.readFileSync(res.manifestPath, 'utf8'));
  expect(archive.verifySnapshot(fs.readFileSync(res.zipPath), manifest)).toBe(true);
});
