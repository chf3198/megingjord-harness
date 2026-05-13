#!/usr/bin/env node
'use strict';
const fs = require('fs');
const path = require('path');
const os = require('os');
const { readTelemetry, summarize } = require('./model-routing-telemetry');

const FILE = path.join(__dirname, 'model-routing-policy.json');
const ADAPTER_FILE = path.join(__dirname, 'routing-provider-adapters.json');
const POLICY_OVERRIDES = path.join(os.homedir(), '.megingjord', 'cascade-policy-overrides.json');

// Wave 8 child 2 (#977): convergence-design item 4 consumer side.
// Read overrides if present; falls back silently when missing/malformed.
function loadOverrides() {
  try {
    if (!fs.existsSync(POLICY_OVERRIDES)) return null;
    return JSON.parse(fs.readFileSync(POLICY_OVERRIDES, 'utf8'));
  } catch { return null; }
}

function loadPolicy() { return JSON.parse(fs.readFileSync(FILE, 'utf8')); }

function loadAdapters() { return JSON.parse(fs.readFileSync(ADAPTER_FILE, 'utf8')); }

function score(text, words) {
  return (words || []).reduce((n, w) => n + (text.includes(w) ? 1 : 0), 0);
}

function classifyTask(prompt, classes) {
  const text = String(prompt || '').toLowerCase();
  const keys = Object.keys(classes || {});
  let best = keys[0] || 'routine';
  let top = -1;
  for (const k of keys) {
    const s = score(text, classes[k]);
    if (s > top) { top = s; best = k; }
  }
  return best;
}

function shouldRollback(policy) {
  const rb = policy.rollback || {};
  if (!rb.enabled) return false;
  const stats = summarize(readTelemetry(rb.windowDays || 7));
  if (stats.samples < 5) return false;
  return stats.successRate < (rb.minSuccessRate ?? 0.75) ||
    stats.premiumShare > (rb.maxPremiumShare ?? 0.45);
}

function resolveRouting(prompt, route) {
  const policy = loadPolicy();
  const rollbackApplied = route.disableRollback ? false : shouldRollback(policy);
  let lane = rollbackApplied ? policy.rollback.forceLane : route.lane;
  const cx = route.complexity ?? 0.5;
  const thresh = policy.complexityThresholds || {};
  if (lane === 'premium' && cx < (thresh.premium ?? 0.7)) lane = cx < (thresh.haiku ?? 0.3) ? 'fleet' : 'haiku';
  const model = policy.models[lane] || policy.models.fallback;
  const adapter = loadAdapters().lanes?.[lane] || {};
  const overrides = loadOverrides();
  return {
    lane,
    modelId: adapter.capabilityTier || model.id,
    providerModelId: adapter.defaultModelId || model.id,
    providerPath: adapter.defaultProvider || model.endpoint || null,
    adapterId: adapter.defaultAdapter || null,
    multiplier: model.mult,
    taskClass: classifyTask(prompt, policy.taskClasses),
    rollbackApplied,
    complexity: cx,
    overridesApplied: overrides !== null,
    overridesStale: overrides?.stale ?? false,
  };
}

module.exports = { resolveRouting, loadPolicy, loadAdapters, loadOverrides };
