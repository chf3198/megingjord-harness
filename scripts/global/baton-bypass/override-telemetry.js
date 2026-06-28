// override-telemetry.js -- Per-gate override telemetry + Tier-2 anneal.
// Refs #3292, Epic #3284 (W4). AC4: per-gate counts + threshold breach.
'use strict';

const MS_PER_DAY = 86400000;
const DAYS_PER_WEEK = 7;

/**
 * Aggregate override events into per-gate-per-week counts.
 * When a gate exceeds the threshold, emit a Tier-2 anneal incident.
 * Pure: events and current time passed in.
 * @param {Array<object>} events - Override events with {ts, gate} fields.
 * @param {{windowDays:number, perGateThreshold:number, nowIso:string}} opts
 * @returns {{counts:object, incidents:Array<object>}}
 */
function aggregateOverrides(events, opts) {
  const windowDays = (opts && opts.windowDays) || DAYS_PER_WEEK;
  const threshold = (opts && opts.perGateThreshold) || 3;
  const nowMs = Date.parse(opts && opts.nowIso || new Date().toISOString());
  const cutoffMs = nowMs - (windowDays * MS_PER_DAY);
  const perGateCounts = {};
  const filtered = (events || []).filter(function inWindow(evt) {
    if (!evt || !evt.ts) return false;
    return Date.parse(evt.ts) > cutoffMs;
  });
  for (const evt of filtered) {
    const gate = evt.gate || 'unknown';
    perGateCounts[gate] = (perGateCounts[gate] || 0) + 1;
  }
  const incidents = [];
  const gateNames = Object.keys(perGateCounts);
  for (const gate of gateNames) {
    if (perGateCounts[gate] > threshold) {
      incidents.push(buildTier2Incident(gate, perGateCounts[gate], threshold, opts));
    }
  }
  return { counts: perGateCounts, incidents };
}

/**
 * Build a Tier-2 anneal incident for threshold breach.
 * @param {string} gate - The gate name that exceeded the threshold.
 * @param {number} count - Actual count for the gate.
 * @param {number} threshold - The configured threshold.
 * @param {{nowIso:string}} opts - Options with current time.
 * @returns {object} A v3-schema Tier-2 incident event.
 */
function buildTier2Incident(gate, count, threshold, opts) {
  return {
    version: 3,
    ts: (opts && opts.nowIso) || new Date().toISOString(),
    service: 'baton-bypass',
    env: 'local',
    event: 'override-threshold-breach',
    tier: 2,
    trigger_type: 'auto',
    pattern_id: 'override-gate-overuse',
    severity: 'medium',
    evidence: {
      gate: gate,
      count: count,
      threshold: threshold,
    },
    _summary: 'Gate ' + gate + ' used ' + String(count)
      + ' times (threshold: ' + String(threshold) + ')',
  };
}

module.exports = { aggregateOverrides, buildTier2Incident };
