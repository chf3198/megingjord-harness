// #3015 — offload KPI aggregator tests (Epic #3008 Phase D).
'use strict';
const { test, expect } = require('@playwright/test');
const kpi = require('../scripts/global/hamr-offload-kpi');
const { hamrOffloadPayload } = require('../dashboard/api/hamr-offload-handlers');

test('computeOffloadKpi returns required keys', () => {
  const now = Date.now();
  const out = kpi.computeOffloadKpi(now);
  expect(out).toHaveProperty('offload_coverage_7d');
  expect(out).toHaveProperty('gate_quality_7d');
  expect(out).toHaveProperty('incident_rate_7d');
  expect(out).toHaveProperty('top_escalation_reasons');
});

test('hamrOffloadPayload ok', () => {
  const p = hamrOffloadPayload();
  expect(p.ok).toBe(true);
  expect(p.kpi).toBeTruthy();
});
