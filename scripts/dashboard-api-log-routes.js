'use strict';
// Dashboard API — log/telemetry routes (split from dashboard-server.js #3173).
const fs = require('fs');
const path = require('path');

function handleLogRoutes(requestUrl, req, res, jsonRes, root) {
  if (requestUrl === '/api/logs/token-telemetry-summary') {
    const { writeTokenTelemetryReport } = require('./global/token-telemetry-report');
    return jsonRes(res, 200, writeTokenTelemetryReport(30));
  }
  if (requestUrl === '/api/logs/quality-parity') {
    const { writeQualityParityReport } = require('./global/quality-parity-report');
    const parsedUrl = new URL(req.url, 'http://localhost');
    const live = parsedUrl.searchParams.get('live') === '1' || process.env.QUALITY_PARITY_LIVE === '1';
    return writeQualityParityReport({ mode: live ? 'live' : 'dry-run' })
      .then((report) => jsonRes(res, 200, report))
      .catch((error) => jsonRes(res, 500, { error: error.message }));
  }
  if (requestUrl === '/api/logs/token-telemetry-reconcile') {
    const { writeReconciliationReport } = require('./global/token-telemetry-reconcile');
    return writeReconciliationReport(30)
      .then((report) => jsonRes(res, 200, report))
      .catch((error) => jsonRes(res, 500, { error: error.message }));
  }
  if (requestUrl === '/api/logs/cost-telemetry') {
    const logFile = path.join(root, 'logs', 'cost-telemetry.jsonl');
    const text = fs.existsSync(logFile) ? fs.readFileSync(logFile, 'utf8') : '';
    res.setHeader('Content-Type', 'text/plain');
    return res.end(text);
  }
  return false;
}

module.exports = { handleLogRoutes };
