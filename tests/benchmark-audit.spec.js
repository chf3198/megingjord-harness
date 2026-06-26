'use strict';
// tdd-pyramid spec for benchmark-audit.js (#3152, Epic #3147 S4). Unit-level, deterministic, $0.
// Covers AC1: the audit reports qualifying surfaces + metric-catalog workflows lacking a benchmark
// suite. Uses an injected catalog + a temp root so the assertions never depend on the live tree.
const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const { auditBenchmarkCoverage, metricSuiteGaps, loadCatalog } = require('../scripts/global/benchmark-audit.js');

function tmpRoot() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'bench-audit-'));
  fs.mkdirSync(path.join(dir, 'tests'), { recursive: true });
  return dir;
}

test('metricSuiteGaps flags a workflow whose suite spec is absent', () => {
  const root = tmpRoot();
  const catalog = { workflows: { alpha: { metric: 'm', baseline: 1, target: 2,
    suite: 'tests/benchmark-alpha.spec.js', backfill_ticket: '#999' } } };
  const gaps = metricSuiteGaps(catalog, root);
  assert.equal(gaps.length, 1);
  assert.equal(gaps[0].workflow, 'alpha');
  assert.equal(gaps[0].backfill_ticket, '#999');
});

test('metricSuiteGaps excludes a workflow whose suite spec exists', () => {
  const root = tmpRoot();
  fs.writeFileSync(path.join(root, 'tests', 'benchmark-beta.spec.js'), '// present');
  const catalog = { workflows: { beta: { metric: 'm', suite: 'tests/benchmark-beta.spec.js' } } };
  assert.deepEqual(metricSuiteGaps(catalog, root), []);
});

test('metricSuiteGaps reports a no-suite-declared workflow', () => {
  const gaps = metricSuiteGaps({ workflows: { gamma: { metric: 'm' } } }, tmpRoot());
  assert.equal(gaps.length, 1);
  assert.equal(gaps[0].reason, 'no-suite-declared');
});

test('auditBenchmarkCoverage composes stress + metric gaps and ok flag', () => {
  const root = tmpRoot();
  const catalog = { workflows: { a: { suite: 'tests/benchmark-a.spec.js' } } };
  const report = auditBenchmarkCoverage({ catalog, root, stressAudit: () => [] });
  assert.equal(report.stressGaps.length, 0);
  assert.equal(report.metricSuiteGaps.length, 1);
  assert.equal(report.ok, false);
});

test('auditBenchmarkCoverage ok=true when no gaps in either class', () => {
  const root = tmpRoot();
  fs.writeFileSync(path.join(root, 'tests', 'benchmark-a.spec.js'), '// present');
  const catalog = { workflows: { a: { suite: 'tests/benchmark-a.spec.js' } } };
  const report = auditBenchmarkCoverage({ catalog, root, stressAudit: () => [] });
  assert.equal(report.ok, true);
});

test('auditBenchmarkCoverage surfaces stress-surface gaps from the injected auditor', () => {
  const report = auditBenchmarkCoverage({ catalog: { workflows: {} },
    stressAudit: () => [{ file: 'scripts/global/x.js', priority: 'P1' }] });
  assert.equal(report.stressGaps.length, 1);
  assert.equal(report.ok, false);
});

test('loadCatalog is resilient to a missing/corrupt file', () => {
  assert.deepEqual(loadCatalog('/nonexistent/path/metric-catalog.yml'), { workflows: {} });
});

test('the committed config/metric-catalog.yml parses and declares the flagship workflows', () => {
  const catalog = loadCatalog(path.resolve(__dirname, '..', 'config', 'metric-catalog.yml'));
  assert.ok(catalog.workflows['wiki-rag-token-reduction'], 'Wiki RAG flagship present');
  assert.ok(catalog.workflows['hamr-fleet-utilization'], 'HAMR flagship present');
  for (const spec of Object.values(catalog.workflows)) {
    assert.ok(spec.metric && spec.suite, 'each workflow declares a metric + suite');
    assert.ok(['higher-better', 'lower-better'].includes(spec.direction), 'valid direction');
  }
});
