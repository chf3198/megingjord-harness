#!/usr/bin/env node
// goal-coverage-handlers.js — API for G1..G9 live signal coverage panel.
// Epic #1339 / #1359 (C8). Per wiki/concepts/harness-logging-inventory.md
// (#1352 / C1), maps each goal to its evidence surfaces and emits live
// counts. Closes the G8 self-reference (observability of observability).
'use strict';

const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const INCIDENTS = path.join(os.homedir(), '.megingjord', 'incidents.jsonl');
const DAY_MS = 86400000;
const WEEK_MS = 604800000;

// Goal → trigger_type filters (from inventory in #1352).
// Each goal gets a coverage_status based on 7d count.
const GOAL_MAP = {
  G1: { name: 'Governance', triggers: ['manual-pull', 'goal-failure'] },
  G2: { name: 'Quality', triggers: ['pattern-recurrence'] },
  G3: { name: 'Zero Cost', triggers: ['sensor-driven'] },
  G4: { name: 'Privacy', triggers: [] },  // gap — no current signal
  G5: { name: 'Portability', triggers: [] },  // gap
  G6: { name: 'Resilience', triggers: ['manual-pull'] },
  G7: { name: 'Throughput', triggers: [] },  // gap (dashboard snapshot only)
  G8: { name: 'Observability', triggers: ['sensor-driven', 'manual-pull'] },
  G9: { name: 'Interoperability', triggers: [] },  // gap
};

function readIncidentEvents() {
  if (!fs.existsSync(INCIDENTS)) return [];
  return fs.readFileSync(INCIDENTS, 'utf8').split('\n').filter(Boolean).map((line) => {
    try { return JSON.parse(line); } catch { return null; }
  }).filter(Boolean);
}

function classifyCoverage(count7d) {
  if (count7d === 0) return 'gap';
  if (count7d < Number('3')) return 'low';
  return 'ok';
}

function computeGoalCoverage(events, nowMs = Date.now()) {
  const result = {};
  for (const [goalId, config] of Object.entries(GOAL_MAP)) {
    let count24h = 0;
    let count7d = 0;
    if (config.triggers.length > 0) {
      for (const event of events) {
        const age = nowMs - Date.parse(event.timestamp || event.ts || 0);
        const trigger = event.trigger_type || '';
        if (!config.triggers.includes(trigger)) continue;
        if (age <= WEEK_MS) count7d++;
        if (age <= DAY_MS) count24h++;
      }
    }
    result[goalId] = {
      name: config.name,
      count_24h: count24h,
      count_7d: count7d,
      coverage_status: config.triggers.length === 0 ? 'gap' : classifyCoverage(count7d),
      sources_count: config.triggers.length,
    };
  }
  return result;
}

function handleGoalCoverage(_request, response) {
  const coverage = computeGoalCoverage(readIncidentEvents());
  const summary = {
    coverage,
    generated_at: new Date().toISOString(),
    source: INCIDENTS,
    legend: { ok: 'count_7d >= 3', low: '0 < count_7d < 3', gap: 'count_7d == 0 (no signal)' },
  };
  response.writeHead(Number('200'), { 'Content-Type': 'application/json' });
  response.end(JSON.stringify(summary));
}

module.exports = {
  route: '/api/goal-coverage',
  handleGoalCoverage, readIncidentEvents, computeGoalCoverage,
  GOAL_MAP, classifyCoverage,
};
