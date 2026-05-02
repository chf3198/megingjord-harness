const { test, expect } = require('@playwright/test');
const path = require('path');
const { recordTelemetry } = require(path.join(__dirname, '../scripts/global/model-routing-telemetry'));

test('token telemetry report summarizes confidence and non-free coverage', () => {
  const { buildTokenTelemetryReport } = require(path.join(__dirname, '../scripts/global/token-telemetry-report'));
  recordTelemetry({ lane: 'fleet', provider: 'ollama', model: 'qwen2.5:7b', total_tokens: 900, confidence_level: 'exact_request', outcome: 'ok' });
  recordTelemetry({ lane: 'premium', provider: 'copilot', model: 'copilot-pro', total_tokens: 600, confidence_level: 'estimated', outcome: 'ok' });
  const report = buildTokenTelemetryReport(30);
  expect(report.samples).toBeGreaterThan(1);
  expect(report.totals.total_tokens).toBeGreaterThan(0);
  expect(report.confidence.exact).toBeGreaterThan(0);
  expect(report.nonFreeCoverage.samples).toBeGreaterThan(0);
  expect(report.providers.some(row => row.provider === 'copilot')).toBeTruthy();
});

test('token telemetry panel render includes confidence and lanes', () => {
  global.esc = value => String(value);
  const { renderTokenTelemetryPanel } = require(path.join(__dirname, '../dashboard/js/token-telemetry.js'));
  const html = renderTokenTelemetryPanel({
    samples: 4,
    totals: { total_tokens: 2200 },
    confidence: { exact: 0.5, estimated: 0.25, other: 0.25 },
    nonFreeCoverage: { samples: 2, share: 0.5 },
    lanes: [{ lane: 'fleet', samples: 2, total_tokens: 1200 }],
    models: [{ model: 'qwen2.5:7b', samples: 2, total_tokens: 1200 }]
  });
  expect(html).toContain('Unified Token Ledger');
  expect(html).toContain('Exact');
  expect(html).toContain('fleet');
});