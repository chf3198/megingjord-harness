'use strict';
// tdd-pyramid + contract tests for the Fleet Advisor observability module (Epic #3414 #3485).

const assert = require('node:assert/strict');
const { test } = require('node:test');
const obs = require('../scripts/global/fleet-advisor-observability.js');
const panel = require('../dashboard/js/fleet-advisor-panel.js');

const METRICS = {
  tier: 'F2',
  fleetCalls: 100,
  freeCloudFallbackRate: 0.2,
  perHost: [{ host: 'a', model: 'qwen2.5-coder:7b', tokensPerSec: 45, coldLoadRate: 0.1, vramPressure: 0.7 }],
  perClass: { correctness: 0.9 },
};

test('AC1 — the report event validates schema-v3 and dollars-saved is the headline', () => {
  const ev = obs.buildReportEvent(METRICS, { ts: '2026-07-01T00:00:00Z' });
  assert.equal(obs.isValidV3(ev).ok, true);
  assert.equal(ev.event, 'fleet-advisor.report');
  assert.equal(ev.service, 'fleet-advisor');
  assert.ok(ev.dollars_saved > 0);
  assert.match(ev._summary, /saved/);
});

test('AC1 — dollarsSaved is conservative and deterministic', () => {
  // 100 calls * 1500 tokens/1000 * $0.004 = $0.6
  assert.equal(obs.dollarsSaved(100), 0.6);
  assert.equal(obs.dollarsSaved(0), 0);
});

test('AC3 — Prometheus exporter publishes the three required metrics with labels', () => {
  const text = obs.prometheusExport(METRICS);
  assert.match(text, /fleet_advisor_tokens_per_second\{host="a",model="qwen2\.5-coder:7b"\} 45/);
  assert.match(text, /fleet_advisor_cold_load_rate\{host="a",model="qwen2\.5-coder:7b"\} 0\.1/);
  assert.match(text, /fleet_advisor_vram_pressure\{host="a",model="qwen2\.5-coder:7b"\} 0\.7/);
  assert.match(text, /# TYPE fleet_advisor_tokens_per_second gauge/);
});

test('AC2 — checkThroughputFloor passes at/above floor, flags regression below', () => {
  const floors = { 'm@F2': 20 };
  assert.equal(obs.checkThroughputFloor([{ model: 'm', tier: 'F2', tokensPerSec: 25 }], floors).ok, true);
  const bad = obs.checkThroughputFloor([{ model: 'm', tier: 'F2', tokensPerSec: 5 }], floors);
  assert.equal(bad.ok, false);
  assert.equal(bad.regressions[0].measured, 5);
  assert.equal(bad.regressions[0].floor, 20);
});

test('panel — summarizeReport + renderFleetAdvisorPanel are defensive and render the headline', () => {
  const ev = obs.buildReportEvent(METRICS, { ts: '2026-07-01T00:00:00Z' });
  const vm = panel.summarizeReport(ev);
  assert.equal(vm.tier, 'F2');
  assert.equal(vm.hosts.length, 1);
  const html = panel.renderFleetAdvisorPanel(ev);
  assert.match(html, /Fleet Advisor throughput/);
  assert.match(html, /saved/);
  // never throws on empty/garbage events
  assert.doesNotThrow(() => panel.renderFleetAdvisorPanel(undefined));
  assert.doesNotThrow(() => panel.summarizeReport(null));
});

test('emitReport writes a valid v3 line to an injected file', () => {
  const fs = require('node:fs');
  const os = require('node:os');
  const path = require('node:path');
  const tmp = path.join(os.tmpdir(), `fa-obs-${process.pid}.jsonl`);
  try {
    const ev = obs.emitReport(METRICS, { ts: '2026-07-01T00:00:00Z', file: tmp });
    const line = JSON.parse(fs.readFileSync(tmp, 'utf8').trim());
    assert.equal(line.event, 'fleet-advisor.report');
    assert.equal(line.dollars_saved, ev.dollars_saved);
  } finally {
    if (fs.existsSync(tmp)) fs.unlinkSync(tmp);
  }
});
