// tier: 3
// fleet-roi-telemetry.js (Epic #3126 AC5): make the $0 workflow's OWN ROI auditable.
//
// The Epic's premise is that the free consensus panel saves money but its troubleshooting
// overhead can quietly exceed the savings. That claim was previously unfalsifiable — nothing
// measured it. This emits a schema-v3 event per run recording overhead (failed dispatches,
// retries, wall-time) against paid-review cost avoided, so "is this actually net-positive?"
// becomes a query rather than an opinion.
'use strict';

const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');

// log-redaction#redactEvent returns {event, hits} — unwrap to the event (G4: values scrubbed
// before they ever reach disk). A missing module degrades to identity (G6: telemetry never
// blocks a governed run).
let redact;
try {
  const { redactEvent } = require('./log-redaction');
  redact = (event) => { const scrubbed = redactEvent(event); return (scrubbed && scrubbed.event) ? scrubbed.event : event; };
} catch { redact = (e) => e; }

const SERVICE = 'fleet-dispatch';
const EVENT = 'fleet.roi';

// Assumed tokens per review call, used to price the avoided paid call. Documented rather
// than hidden: the absolute $ is an estimate; the SIGN (net-positive or not) is the signal.
const ASSUMED_TOKENS_PER_CALL = 1500;
const DEFAULT_PAID_COST_PER_1K = 0.0008;

function logPath() {
  if (process.env.MEGINGJORD_ROI_LOG) return process.env.MEGINGJORD_ROI_LOG;
  return path.join(process.env.MEGINGJORD_HOME || path.join(os.homedir(), '.megingjord'), 'fleet-roi.jsonl');
}

function paidCostPer1k() {
  const configured = Number(process.env.MEGINGJORD_PAID_COST_PER_1K);
  return Number.isFinite(configured) && configured > 0 ? configured : DEFAULT_PAID_COST_PER_1K;
}

// Cost avoided = the paid calls we did NOT make because a $0 resource served them.
function costAvoided(freeCalls, tokensPerCall = ASSUMED_TOKENS_PER_CALL) {
  const calls = Math.max(0, Number(freeCalls) || 0);
  return (calls * tokensPerCall / 1000) * paidCostPer1k();
}

// Overhead is denominated in wasted WORK, not dollars: a failed dispatch or retry costs
// wall-time and (on paid fallback) real tokens. `wasted_ms` is the honest headline.
function summarize(run = {}) {
  const freeCalls = Math.max(0, Number(run.free_calls) || 0);
  const failed = Math.max(0, Number(run.failed_dispatches) || 0);
  const retries = Math.max(0, Number(run.retries) || 0);
  const paidFallbacks = Math.max(0, Number(run.paid_fallbacks) || 0);
  const avoided = costAvoided(freeCalls, run.tokens_per_call);
  const paidSpent = costAvoided(paidFallbacks, run.tokens_per_call); // same pricing, actually spent
  return {
    free_calls: freeCalls,
    failed_dispatches: failed,
    retries,
    paid_fallbacks: paidFallbacks,
    wall_ms: Math.max(0, Number(run.wall_ms) || 0),
    wasted_ms: Math.max(0, Number(run.wasted_ms) || 0),
    cost_avoided_usd: Number(avoided.toFixed(6)),
    cost_spent_usd: Number(paidSpent.toFixed(6)),
    net_usd: Number((avoided - paidSpent).toFixed(6)),
    // The Epic's own success condition, computed rather than asserted.
    net_positive: avoided > paidSpent,
  };
}

function buildEvent(run = {}) {
  const summary = summarize(run);
  return redact({
    ts: new Date().toISOString(),
    version: 3,
    service: SERVICE,
    env: process.env.NODE_ENV || 'local',
    event: EVENT,
    trigger_role: run.trigger_role || 'system',
    ticket: run.ticket || null,
    panel_families: Array.isArray(run.families) ? run.families : [],
    stop_reason: run.stop_reason || null,
    ...summary,
    _summary: `fleet ROI: ${summary.free_calls} free call(s), ${summary.failed_dispatches} failed, `
      + `net $${summary.net_usd} (${summary.net_positive ? 'net-positive' : 'NOT net-positive'})`,
  });
}

// Append-only; a telemetry failure must never break a governed run (G6/G8).
function recordRun(run = {}, opts = {}) {
  const event = buildEvent(run);
  const file = opts.file || logPath();
  try {
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.appendFileSync(file, `${JSON.stringify(event)}\n`);
    return { ok: true, event, file };
  } catch (err) {
    return { ok: false, event, error: err.message };
  }
}

module.exports = {
  recordRun, buildEvent, summarize, costAvoided,
  ASSUMED_TOKENS_PER_CALL, DEFAULT_PAID_COST_PER_1K, SERVICE, EVENT, logPath,
};
