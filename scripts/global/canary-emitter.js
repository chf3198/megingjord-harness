#!/usr/bin/env node
'use strict';
// tier: 1
// canary-emitter.js (#3795, Epic #3789 §3.3) — post-merge canary + auto-rollback signals for
// the security-surface lane. A dark-launched flag is enabled for ONE non-critical runtime,
// observed for a bounded window, and auto-rolled-back on regression (Argo Rollouts / Flagger
// AnalysisTemplate pattern). Emits event-schema-v3 events to dashboard/events.jsonl so the flip
// is auditable change-management evidence. Rollback is a flag write (seconds), not a revert.
const path = require('node:path');
const { emitV3 } = require('./event-schema-v3');

const EVENTS_FILE = path.join(__dirname, '..', '..', 'dashboard', 'events.jsonl');
// Fixed canary-metrics schema: the observable signals the rollback predicate consumes.
const CANARY_METRICS_SCHEMA = ['error_rate', 'auth_reject_rate', 'latency_p99_ms', 'sample_count'];
// Default rollback thresholds (breach => auto-rollback). Named so no bare literals leak.
const DEFAULT_THRESHOLDS = { error_rate: 0.02, auth_reject_rate: 0.05, latency_p99_ms: 750 };
const KINDS = ['merged-dark', 'canary-start', 'canary-rollback', 'canary-promote'];

/** Decide whether observed canary metrics breach the rollback predicate.
 * @param {object} metrics - a canary-metrics object (CANARY_METRICS_SCHEMA keys).
 * @param {object} [thresholds] - override thresholds; defaults to DEFAULT_THRESHOLDS.
 * @returns {{breach: boolean, signal: (string|null)}}
 */
function rollbackPredicate(metrics, thresholds = DEFAULT_THRESHOLDS) {
  const m = metrics || {};
  for (const key of Object.keys(thresholds)) {
    if (typeof m[key] === 'number' && m[key] > thresholds[key]) {
      return { breach: true, signal: `${key}>${thresholds[key]}` };
    }
  }
  return { breach: false, signal: null };
}

/** Build + append a v3 canary event; returns the emitted event. `kind` must be a KIND. */
function emitCanaryEvent(kind, payload = {}, file = EVENTS_FILE) {
  if (!KINDS.includes(kind)) throw new Error(`unknown canary kind: ${kind}`);
  const event = {
    ts: new Date().toISOString(),
    version: 3,
    service: 'canary',
    env: process.env.MEGINGJORD_ENV || 'local',
    event: `event:${kind}`,
    team: process.env.HAMR_TEAM || 'claude-code',
    trigger_role: 'system',
    flag_name: payload.flag_name || null,
    canary_scope: payload.canary_scope || null,
    metrics: payload.metrics || null,
    regression_signal: payload.regression_signal || null,
  };
  emitV3(event, file);
  return event;
}

/** Emit merged-dark: the flag landed on main, default-OFF, awaiting canary. */
function emitMergedDark(flagName, file) { return emitCanaryEvent('merged-dark', { flag_name: flagName }, file); }

/** Emit canary-start for one non-critical scope. */
function emitCanaryStart(flagName, scope, file) {
  return emitCanaryEvent('canary-start', { flag_name: flagName, canary_scope: scope }, file);
}

/** Evaluate metrics and emit either canary-rollback (on breach) or canary-promote. Returns the event. */
function evaluateAndEmit(flagName, metrics, file, thresholds) {
  const { breach, signal } = rollbackPredicate(metrics, thresholds);
  const kind = breach ? 'canary-rollback' : 'canary-promote';
  return emitCanaryEvent(kind, { flag_name: flagName, metrics, regression_signal: signal }, file);
}

module.exports = {
  rollbackPredicate, emitCanaryEvent, emitMergedDark, emitCanaryStart, evaluateAndEmit,
  CANARY_METRICS_SCHEMA, DEFAULT_THRESHOLDS, KINDS, EVENTS_FILE,
};
