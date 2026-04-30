#!/usr/bin/env node
'use strict';
// Cost telemetry — per-dispatch cost accounting, separate from routing telemetry.
const fs = require('fs');
const path = require('path');

const FILE = path.join(__dirname, '..', '..', 'logs', 'cost-telemetry.jsonl');
const MAX_ENTRIES = 500;

// Blended $/request at ~3K tokens avg (2026 Anthropic/OpenRouter pricing)
const COST_PER_REQ = {
  free: 0,
  fleet: 0,
  haiku: 0.00264,  // 3K * $0.00088/1K
  premium: 0.027,  // 3K * $0.009/1K
};

const MONTHLY_BUDGET_USD = 10;

function ensureDir() { fs.mkdirSync(path.dirname(FILE), { recursive: true }); }

function recordCostEvent(lane, model, opts = {}) {
  ensureDir();
  const cost = COST_PER_REQ[lane] ?? COST_PER_REQ.premium;
  const row = {
    ts: new Date().toISOString(),
    lane: lane || 'free',
    model: model || 'unknown',
    cost_usd: cost,
    outcome: opts.outcome || 'ok',
    escalation_reason: opts.escalation_reason || null,
    rate_limit: opts.rate_limit || false,
  };
  const existing = fs.existsSync(FILE)
    ? fs.readFileSync(FILE, 'utf8').split('\n').filter(Boolean) : [];
  const lines = [...existing.slice(-(MAX_ENTRIES - 1)), JSON.stringify(row)];
  fs.writeFileSync(FILE, lines.join('\n') + '\n');
  return row;
}

function readCostEvents(days = 30) {
  if (!fs.existsSync(FILE)) return [];
  const cutoff = Date.now() - days * 86400000;
  return fs.readFileSync(FILE, 'utf8').split('\n').filter(Boolean)
    .map(l => { try { return JSON.parse(l); } catch { return null; } })
    .filter(r => r && new Date(r.ts).getTime() >= cutoff);
}

function summarizeCost(entries) {
  const n = entries.length || 1;
  const byLane = {};
  let totalCost = 0;
  entries.forEach(e => {
    byLane[e.lane] = (byLane[e.lane] || 0) + 1;
    totalCost += e.cost_usd || 0;
  });
  const daysInWindow = 30;
  const projectedMonthly = entries.length
    ? (totalCost / daysInWindow) * 30 : 0;
  const budgetPct = (projectedMonthly / MONTHLY_BUDGET_USD * 100).toFixed(1);
  return {
    samples: entries.length,
    totalCostUsd: +totalCost.toFixed(4),
    projectedMonthlyUsd: +projectedMonthly.toFixed(2),
    budgetPct: +budgetPct,
    budgetAlert: projectedMonthly > MONTHLY_BUDGET_USD * 0.8,
    byLane: Object.fromEntries(
      Object.entries(byLane).map(([k, v]) => [k, { count: v, pct: +((v / n) * 100).toFixed(1) }])
    ),
  };
}

if (require.main === module) {
  const events = readCostEvents(30);
  const s = summarizeCost(events);
  console.log(`Cost baseline (last 30d): $${s.totalCostUsd} actual`);
  console.log(`Projected monthly: $${s.projectedMonthlyUsd} / $${MONTHLY_BUDGET_USD} budget`);
  console.log(`Budget used: ${s.budgetPct}%${s.budgetAlert ? ' ⚠ ALERT' : ''}`);
  Object.entries(s.byLane).forEach(([k, v]) =>
    console.log(`  ${k.padEnd(8)} ${v.count} req (${v.pct}%)`));
}

module.exports = { recordCostEvent, readCostEvents, summarizeCost, MONTHLY_BUDGET_USD };
