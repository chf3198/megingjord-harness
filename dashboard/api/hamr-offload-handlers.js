#!/usr/bin/env node
'use strict';
// #3015 — /api/hamr-offload KPI payload for dashboard panel.
const path = require('node:path');
const { computeOffloadKpi } = require(path.join(__dirname, '..', '..', 'scripts', 'global', 'hamr-offload-kpi.js'));

function hamrOffloadPayload() {
  const kpi = computeOffloadKpi();
  return { ok: true, kpi, warnings: [] };
}

module.exports = { hamrOffloadPayload };

if (require.main === module) process.stdout.write(JSON.stringify(hamrOffloadPayload(), null, 2) + '\n');
