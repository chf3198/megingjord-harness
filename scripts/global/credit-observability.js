'use strict';
// Per-ticket credit observability (Epic #3576 W-F, E7/E13). Computes the free-tier
// utilization ratio (the true G3 headline metric — % of execution done at $0),
// cost-per-net-line, and a read-cost proxy, from routing telemetry. Pure functions
// take entries directly; the CLI reads model-routing-telemetry defensively.
const FREE_LANES = ['free', 'fleet', 'free-cloud'];
const PAID_LANES = ['haiku', 'premium'];

function freeTierUtilization(entries) {
  const list = Array.isArray(entries) ? entries : [];
  const total = list.length;
  if (!total) return { ratio: null, free: 0, paid: 0, total: 0 };
  const free = list.filter((e) => FREE_LANES.includes(e && e.lane)).length;
  const paid = list.filter((e) => PAID_LANES.includes(e && e.lane)).length;
  return { ratio: +(free / total).toFixed(3), free, paid, total };
}

function costPerNetLine(costUsd, netLines) {
  const lines = Number(netLines);
  if (!lines || !Number.isFinite(lines)) return null;
  return +(Number(costUsd || 0) / lines).toFixed(4);
}

// Governance artifacts are re-read by every downstream role on paid models, so free
// authorship never means free consumption — artifact volume is the read-cost proxy (E13).
function readCostProxy(artifactCount) {
  return { artifacts: Number(artifactCount) || 0,
    note: 'artifact volume re-read by downstream roles (read-cost survives free authorship)' };
}

function ticketCreditSummary(ticket, opts = {}) {
  const entries = (Array.isArray(opts.entries) ? opts.entries : [])
    .filter((e) => !ticket || (e && String(e.ticket) === String(ticket)));
  const util = freeTierUtilization(entries);
  const totalTokens = entries.reduce((s, e) => s + (Number(e && e.total_tokens) || 0), 0);
  return { ticket: ticket || 'all', samples: entries.length, total_tokens: totalTokens,
    free_tier_utilization: util.ratio, free_samples: util.free, paid_samples: util.paid };
}

module.exports = { freeTierUtilization, costPerNetLine, readCostProxy, ticketCreditSummary, FREE_LANES, PAID_LANES };

if (require.main === module) {
  const arg = (k) => { const idx = process.argv.indexOf('--' + k); return idx > -1 ? process.argv[idx + 1] : undefined; };
  let entries = [];
  try { entries = require('./model-routing-telemetry').readTelemetry(Number(arg('days')) || 30); } catch { /* telemetry optional */ }
  console.log(JSON.stringify(ticketCreditSummary(arg('ticket'), { entries }), null, 2));
}
