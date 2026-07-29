'use strict';
// Epic #3576 W-F (#3586) — credit observability computer + advisory validator.
const { test, expect } = require('@playwright/test');
const path = require('node:path');
const co = require(path.resolve(__dirname, '../scripts/global/credit-observability'));
const val = require(path.resolve(__dirname, '../scripts/global/megalint/credit-observability'));

test('freeTierUtilization: ratio of $0 lanes to total', () => {
  const r = co.freeTierUtilization([{ lane: 'fleet' }, { lane: 'free-cloud' }, { lane: 'haiku' }, { lane: 'premium' }]);
  expect(r.total).toBe(4); expect(r.free).toBe(2); expect(r.paid).toBe(2); expect(r.ratio).toBe(0.5);
});
test('freeTierUtilization: empty -> null ratio', () => {
  expect(co.freeTierUtilization([]).ratio).toBeNull();
});
test('costPerNetLine: divides, guards zero', () => {
  expect(co.costPerNetLine(1.0, 4)).toBe(0.25);
  expect(co.costPerNetLine(1.0, 0)).toBeNull();
});
test('readCostProxy: counts artifact volume', () => {
  expect(co.readCostProxy(6).artifacts).toBe(6);
});
test('ticketCreditSummary: filters by ticket', () => {
  const e = [{ ticket: 3586, lane: 'fleet', total_tokens: 100 }, { ticket: 9, lane: 'haiku', total_tokens: 50 }];
  const s = co.ticketCreditSummary(3586, { entries: e });
  expect(s.samples).toBe(1); expect(s.total_tokens).toBe(100); expect(s.free_tier_utilization).toBe(1);
});
test('validator: flags missing credit_budget, always advisory', () => {
  const r = val.validate({ labels: ['lane:code-change'], comments: [{ body: '## MANAGER_HANDOFF\nscope: x' }] });
  expect(r.violations.some((v) => v.rule === 'credit-budget-missing')).toBe(true);
  expect(r.violations.every((v) => v.severity === 'advisory')).toBe(true);
});
test('validator: non-code-change lane skipped', () => {
  expect(val.validate({ labels: ['lane:docs-research'], comments: [] }).ok).toBe(true);
});
