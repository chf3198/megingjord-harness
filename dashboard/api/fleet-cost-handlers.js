#!/usr/bin/env node
// fleet-cost-handlers.js — /api/fleet-cost: fleet-dev net cost-of-quality for the dashboard panel
// (#2800 P1-7, Epic #2791). Serves the aggregator's report (fleet-development-share, escalation-rate,
// gross saving, verification overhead, NET cost-of-quality, audit). Read-only; never throws to the server.
'use strict';

const { buildReport } = require('../../scripts/global/fleet-dev-cost-report');

function handleFleetCost(req, res, opts) {
  let payload;
  try { payload = buildReport(opts || {}); }
  catch (err) { payload = { error: 'fleet-cost-unavailable', detail: err && err.code }; }
  res.writeHead(200, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify(payload));
}

module.exports = { handleFleetCost };
