#!/usr/bin/env node
'use strict';
const fs = require('fs');
const path = require('path');

const FILE = path.join(__dirname, '..', '..', 'logs', 'model-routing-telemetry.jsonl');

function ensureDir() { fs.mkdirSync(path.dirname(FILE), { recursive: true }); }

function recordTelemetry(entry) {
  ensureDir();
  // Extended schema: includes cascade fields, quality assessment, semantic intent
  const row = {
    ts: new Date().toISOString(),
    lane: entry.lane || 'free',
    model: entry.model || 'unknown',
    multiplier: entry.multiplier ?? 0,
    taskClass: entry.taskClass || 'routine',
    semanticIntent: entry.semanticIntent || null,
    promptTokens: entry.promptTokens || null,
    responseLength: entry.response_length || entry.responseLength || null,
    latencyMs: entry.latency_ms || entry.latencyMs || null,
    outcome: entry.outcome || 'ok',
    escalation: entry.escalation || null,
    qualityReason: entry.quality_reason || entry.qualityReason || null,
    rollbackApplied: entry.rollbackApplied || false,
    execute: entry.execute || false,
  };
  fs.appendFileSync(FILE, JSON.stringify(row) + '\n');
  return row;
}

function readTelemetry(days = 30) {
  if (!fs.existsSync(FILE)) return [];
  const cutoff = Date.now() - days * 86400000;
  return fs.readFileSync(FILE, 'utf8').split('\n').filter(Boolean)
    .map(l => { try { return JSON.parse(l); } catch { return null; } })
    .filter(r => r && new Date(r.ts).getTime() >= cutoff);
}

function summarize(entries) {
  const n = entries.length || 1;
  const byLane = { free: 0, fleet: 0, haiku: 0, premium: 0 };
  const escalations = { haiku: 0, premium: 0 };
  entries.forEach(e => {
    byLane[e.lane] = (byLane[e.lane] || 0) + 1;
    if (e.escalation) escalations[e.escalation] = (escalations[e.escalation] || 0) + 1;
  });
  const premium = entries.filter(e => e.lane === 'premium').length;
  const ok = entries.filter(e => e.outcome === 'ok').length;
  const rollback = entries.filter(e => e.rollbackApplied).length;
  const mult = entries.reduce((s, e) => s + (Number(e.multiplier) || 0), 0);
  return {
    samples: entries.length,
    laneDistribution: Object.fromEntries(
      Object.entries(byLane).map(([k, v]) => [k, +(v / n).toFixed(3)])
    ),
    escalationCounts: escalations,
    premiumShare: +(premium / n).toFixed(3),
    successRate: +(ok / n).toFixed(3),
    failRate: +((n - ok) / n).toFixed(3),
    rollbackRate: +(rollback / n).toFixed(3),
    avgMultiplier: +(mult / n).toFixed(3),
  };
}

module.exports = { recordTelemetry, readTelemetry, summarize, FILE };
