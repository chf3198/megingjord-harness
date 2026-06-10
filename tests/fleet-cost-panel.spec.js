// Refs #2800 P1-7 — fleet-cost dashboard panel. DOM-DETERMINISTIC visual test (the web-regression-governance
// fallback to pixel screenshots): renderFleetCost is a pure renderer, so we assert the rendered DOM string
// without a live server — stable, fast, and CI-friendly.
const { test, expect } = require('@playwright/test');
const { renderFleetCost, pct, usd } = require('../dashboard/js/fleet-cost-panel.js');

// Minimal element stub: the renderer only writes innerHTML.
const stubEl = () => ({ innerHTML: '' });

const REPORT = {
  fleet_development_share: 0.8, escalation_rate: 0.15,
  gross_saving_usd: 0.0898, verification_overhead_usd: 0.016, net_cost_of_quality_usd: 0.0738,
};

test('#2800 panel renders share / escalation / gross / overhead / NET', () => {
  const el = stubEl();
  renderFleetCost(el, REPORT);
  expect(el.innerHTML).toContain('80.0%');   // fleet-dev share
  expect(el.innerHTML).toContain('15.0%');   // escalation rate
  expect(el.innerHTML).toContain('$0.0898'); // gross
  expect(el.innerHTML).toContain('$0.0160'); // overhead
  expect(el.innerHTML).toContain('$0.0738'); // NET
  expect(el.innerHTML).toMatch(/data-fc="net"/);
});

test('#2800 panel colour-codes the NET: green when ≥0, red when <0', () => {
  const pos = stubEl(); renderFleetCost(pos, { ...REPORT, net_cost_of_quality_usd: 0.05 });
  expect(pos.innerHTML).toContain('#2ea043'); // green
  const neg = stubEl(); renderFleetCost(neg, { ...REPORT, net_cost_of_quality_usd: -0.02 });
  expect(neg.innerHTML).toContain('#d1242f'); // red — net loss is visible
});

test('#2800 panel renders a graceful error state on a missing/error report', () => {
  const el = stubEl();
  renderFleetCost(el, { error: true });
  expect(el.innerHTML).toContain('fleet-cost unavailable');
  expect(() => renderFleetCost(null, REPORT)).not.toThrow(); // null element is a safe no-op
});

test('#2800 pct/usd format helpers are correct + null-safe', () => {
  expect(pct(0.123)).toBe('12.3%');
  expect(pct(undefined)).toBe('0.0%');
  expect(usd(0.5)).toBe('$0.5000');
  expect(usd(null)).toBe('$0.0000');
});
