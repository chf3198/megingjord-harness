// Refs #2800 P1-7 of Epic #2791 — fleet-dev net cost-of-quality aggregator + API handler. Filesystem-free:
// telemetry entries are injected.
const { test, expect } = require('@playwright/test');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { aggregate, readEntries } = require('../scripts/global/fleet-dev-cost-report.js');
const { handleFleetCost } = require('../dashboard/api/fleet-cost-handlers.js');

const routing = [...Array(8).fill({ lane: 'fleet' }), ...Array(2).fill({ lane: 'premium' })];
const escalations = Array(2).fill({ event: 'fleet-dev-escalation' });
const COSTS = { haikuCostPer1k: 0.001, verificationCostPerAttempt: 0.0001 };

test('#2800 AC1 fleet-development-share + escalation-rate are computed per the telemetry', () => {
  const out = aggregate({ routing, escalations, demotions: [], ...COSTS });
  expect(out.fleet_development_share).toBeCloseTo(0.8, 6); // 8 fleet / 10 total
  expect(out.escalation_rate).toBeCloseTo(0.25, 6); // 2 escalated / 8 fleet
  expect(out.accepted).toBe(6);
});

test('#2800 AC2 reports the NET cost-of-quality (gross MINUS verification overhead), not gross', () => {
  const out = aggregate({ routing, escalations, demotions: [], ...COSTS });
  // gross = accepted(6) * (1500/1000 * 0.001) = 6 * 0.0015 = 0.009
  expect(out.gross_saving_usd).toBeCloseTo(0.009, 6);
  // overhead = fleet_attempts(8) * 0.0001 = 0.0008
  expect(out.verification_overhead_usd).toBeCloseTo(0.0008, 6);
  expect(out.net_cost_of_quality_usd).toBeCloseTo(0.0082, 6); // NET = gross - overhead
  expect(out.net_cost_of_quality_usd).not.toBe(out.gross_saving_usd); // net != gross
});

test('#2800 AC3 the human-audit surface reports demotion patterns + pending placeholders', () => {
  const demotions = [
    { event: 'fleet-dev-class-mis-profiled', task_class: 'area:dashboard' },
    { event: 'fleet-dev-class-mis-profiled', task_class: 'area:dashboard' },
    { event: 'fleet-dev-class-mis-profiled', task_class: 'area:scripts' },
  ];
  const out = aggregate({ routing, escalations, demotions, ...COSTS });
  expect(out.audit.demotions_by_class).toEqual({ 'area:dashboard': 2, 'area:scripts': 1 });
  expect(out.audit.deny_list_efficacy).toMatch(/#2798/);
  expect(out.audit.critic_drift).toMatch(/#2797/);
});

test('#2800 empty/zero telemetry yields zeroes, never divide-by-zero', () => {
  const out = aggregate({ routing: [], escalations: [], demotions: [] });
  expect(out.fleet_development_share).toBe(0);
  expect(out.escalation_rate).toBe(0);
  expect(out.net_cost_of_quality_usd).toBe(0);
});

test('#2800 readEntries is graceful — a missing file is [], a malformed line is skipped', () => {
  expect(readEntries('/no/such/file.jsonl')).toEqual([]);
  const file = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'fc-')), 'x.jsonl');
  fs.writeFileSync(file, '{"a":1}\nNOT JSON\n{"a":2}\n');
  expect(readEntries(file).map((entry) => entry.a)).toEqual([1, 2]); // malformed middle line skipped
});

test('#2800 SECURITY: a "__proto__" task_class in audit does not pollute Object.prototype', () => {
  const out = aggregate({ routing, escalations, demotions: [
    { event: 'fleet-dev-class-mis-profiled', task_class: '__proto__' }], ...COSTS });
  expect(out.audit.demotions_by_class.__proto__).toBe(1); // counted as a normal own key
  expect({}.polluted).toBeUndefined(); // Object.prototype intact
});

test('#2800 AC4 the /api/fleet-cost handler returns a JSON report, never throws to the server', () => {
  let captured = null;
  const res = { writeHead() {}, end(body) { captured = body; } };
  handleFleetCost({}, res, { routing, escalations, demotions: [], ...COSTS });
  const payload = JSON.parse(captured);
  expect(payload.fleet_development_share).toBeCloseTo(0.8, 6);
  expect(payload).toHaveProperty('net_cost_of_quality_usd');
});
