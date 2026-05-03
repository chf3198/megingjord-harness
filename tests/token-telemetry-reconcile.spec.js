const { test, expect } = require('@playwright/test');
const path = require('path');

test('reconciliation report has required structure', async () => {
  const { buildReconciliationReport, DEFAULT_THRESHOLDS } = require(
    path.join(__dirname, '../scripts/global/token-telemetry-reconcile')
  );
  const report = await buildReconciliationReport(30);
  expect(report).toHaveProperty('generated_at');
  expect(report).toHaveProperty('period_days', 30);
  expect(report).toHaveProperty('thresholds');
  expect(report.thresholds).toMatchObject(DEFAULT_THRESHOLDS);
  expect(report).toHaveProperty('verdicts');
  expect(Array.isArray(report.verdicts)).toBe(true);
  expect(report).toHaveProperty('alerts');
  expect(['OK', 'WARN', 'FAIL']).toContain(report.overall);
});

test('reconciliation verdict includes provider lane + confidence impact fields', async () => {
  const { buildReconciliationReport } = require(
    path.join(__dirname, '../scripts/global/token-telemetry-reconcile')
  );
  const report = await buildReconciliationReport(30, { min_samples: 1 });
  if (report.verdicts.length) {
    expect(report.verdicts[0]).toHaveProperty('lane');
    expect(report.verdicts[0]).toHaveProperty('confidence_impact');
  }
});

test('reconciliation thresholds are configurable', async () => {
  const { buildReconciliationReport } = require(
    path.join(__dirname, '../scripts/global/token-telemetry-reconcile')
  );
  const report = await buildReconciliationReport(30, { drift_pct: 0.05, drift_pct_fail: 0.2, min_samples: 1 });
  expect(report.thresholds.drift_pct).toBe(0.05);
  expect(report.thresholds.drift_pct_fail).toBe(0.2);
});

test('reconcile panel renders verdict table', () => {
  global.esc = v => String(v);
  const { renderTokenReconcilePanel } = require(
    path.join(__dirname, '../dashboard/js/token-reconcile')
  );
  const html = renderTokenReconcilePanel({
    overall: 'OK',
    thresholds: { drift_pct: 0.15, drift_pct_fail: 0.35, min_samples: 3 },
    verdicts: [{ provider: 'openrouter', lane: 'premium', confidence_impact: 0.25, verdict: 'UNREACHABLE', local_tokens: 500, remote_tokens: null, drift_pct: null, agg_ok: false }],
    alerts: [],
  });
  expect(html).toContain('Token Drift Reconciliation');
  expect(html).toContain('openrouter');
  expect(html).toContain('premium');
  expect(html).toContain('Confidence impact');
  expect(html).toContain('UNREACHABLE');
  expect(html).toContain('No drift alerts');
});
