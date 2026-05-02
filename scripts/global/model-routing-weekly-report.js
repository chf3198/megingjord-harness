#!/usr/bin/env node
'use strict';
const fs = require('fs');
const path = require('path');
const { readTelemetry, summarize } = require('./model-routing-telemetry');
const { loadUsage } = require('../copilot-tracker');

function report() {
  const week = readTelemetry(7);
  const prev = readTelemetry(14).filter(e => new Date(e.ts).getTime() < Date.now() - 7 * 86400000);
  const now = summarize(week);
  const old = summarize(prev);
  const usage = loadUsage();
  return {
    generatedAt: new Date().toISOString(),
    period: usage.period,
    premiumShare: { current: now.premiumShare, previous: old.premiumShare, delta: now.premiumShare - old.premiumShare },
    quality: { successRate: now.successRate, failRate: now.failRate, rollbackRate: now.rollbackRate },
    efficiency: { avgMultiplier: now.avgMultiplier, requests: usage.manualOverride?.requests ?? usage.requests }
  };
}

if (require.main === module) {
  const out = report();
  const file = path.join(__dirname, '..', '..', 'logs', 'model-routing-weekly.json');
  fs.writeFileSync(file, JSON.stringify(out, null, 2));
  console.log(JSON.stringify(out, null, 2));
}

module.exports = { report };
