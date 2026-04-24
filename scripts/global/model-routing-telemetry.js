#!/usr/bin/env node
'use strict';
const fs = require('fs');
const path = require('path');

const FILE = path.join(__dirname, '..', '..', 'logs', 'model-routing-telemetry.jsonl');

function ensureDir() { fs.mkdirSync(path.dirname(FILE), { recursive: true }); }

function recordTelemetry(entry) {
  ensureDir();
  const row = { ts: new Date().toISOString(), ...entry };
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
  const premium = entries.filter(e => e.lane === 'premium').length;
  const ok = entries.filter(e => e.outcome === 'ok').length;
  const fail = entries.filter(e => e.outcome === 'fail').length;
  const rollback = entries.filter(e => e.rollbackApplied).length;
  const mult = entries.reduce((s, e) => s + (Number(e.multiplier) || 0), 0);
  return {
    samples: entries.length,
    premiumShare: premium / n,
    successRate: ok / n,
    failRate: fail / n,
    rollbackRate: rollback / n,
    avgMultiplier: mult / n,
  };
}

module.exports = { recordTelemetry, readTelemetry, summarize, FILE };
