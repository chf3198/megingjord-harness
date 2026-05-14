// Tests for scripts/global/lint-coverage-metric.js (Epic #1510 #1521).
const { test, expect } = require('@playwright/test');
const fs = require('fs');
const os = require('os');
const path = require('path');
const metric = require('../scripts/global/lint-coverage-metric');

const manifest = (practices) => ({ schemaVersion: 1, practices });

test('#1521 AC1: computeCoverage with all enforced returns 100% of lintable', () => {
  const m = metric.computeCoverage(manifest([
    { id: 'a', status: 'lint-enforced' },
    { id: 'b', status: 'tool-enforced' },
  ]));
  expect(m.total).toBe(2);
  expect(m.enforced).toBe(2);
  expect(m.coverageOfLintablePercent).toBe(100);
});

test('#1521 AC1: model-judgment items excluded from lintable denominator', () => {
  const m = metric.computeCoverage(manifest([
    { id: 'a', status: 'lint-enforced' },
    { id: 'b', status: 'model-judgment' },
    { id: 'c', status: 'model-judgment' },
  ]));
  expect(m.coverageOfLintablePercent).toBe(100);  // 1/1 lintable
  expect(m.coverageOfAllPercent).toBeCloseTo(33.3, 1);
});

test('#1521 AC1: instruction-only items count in denominator but not numerator', () => {
  const m = metric.computeCoverage(manifest([
    { id: 'a', status: 'lint-enforced' },
    { id: 'b', status: 'instruction-only' },
  ]));
  expect(m.coverageOfLintablePercent).toBe(50);
  expect(m.uncoveredPracticeIds).toEqual(['b']);
});

test('#1521 AC1: empty manifest returns zero coverage (no division-by-zero)', () => {
  const m = metric.computeCoverage(manifest([]));
  expect(m.total).toBe(0);
  expect(m.coverageOfLintablePercent).toBe(0);
});

test('#1521 AC1: uncoveredPracticeIds names every instruction-only practice', () => {
  const m = metric.computeCoverage(manifest([
    { id: 'cyclomatic', status: 'instruction-only' },
    { id: 'secret-scan', status: 'instruction-only' },
    { id: 'a', status: 'lint-enforced' },
  ]));
  expect(m.uncoveredPracticeIds).toEqual(['cyclomatic', 'secret-scan']);
});

test('#1521 AC2: real manifest meets the ≥70% target', () => {
  const real = metric.loadManifest();
  const m = metric.computeCoverage(real);
  expect(m.coverageOfLintablePercent).toBeGreaterThanOrEqual(70);
});

test('#1521 AC4: loadManifest throws on missing file', () => {
  expect(() => metric.loadManifest('/tmp/nonexistent.json')).toThrow(/not found/);
});

test('#1521 AC4: loadManifest reads JSON from a valid path', () => {
  const tmp = path.join(os.tmpdir(), `coverage-test-${Date.now()}.json`);
  fs.writeFileSync(tmp, JSON.stringify(manifest([{ id: 'x', status: 'lint-enforced' }])));
  const loaded = metric.loadManifest(tmp);
  expect(loaded.practices).toHaveLength(1);
  fs.unlinkSync(tmp);
});

test('#1521 AC1: ENFORCED_STATUSES exported for external use', () => {
  expect(metric.ENFORCED_STATUSES).toContain('lint-enforced');
  expect(metric.ENFORCED_STATUSES).toContain('tool-enforced');
  expect(metric.ENFORCED_STATUSES).not.toContain('instruction-only');
});

test('#1521 AC1: percentages rounded to 1 decimal', () => {
  const m = metric.computeCoverage(manifest([
    { id: 'a', status: 'lint-enforced' },
    { id: 'b', status: 'lint-enforced' },
    { id: 'c', status: 'instruction-only' },
  ]));
  expect(m.coverageOfLintablePercent).toBeCloseTo(66.7, 1);
});
