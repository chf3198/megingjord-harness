#!/usr/bin/env node
'use strict';
const fs = require('fs');
const path = require('path');
const { readTelemetry, summarize } = require('./model-routing-telemetry');

const FILE = path.join(__dirname, 'model-routing-policy.json');

function loadPolicy() { return JSON.parse(fs.readFileSync(FILE, 'utf8')); }

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
  const rollbackApplied = shouldRollback(policy);
  const lane = rollbackApplied ? policy.rollback.forceLane : route.lane;
  const model = policy.models[lane] || policy.models.fallback;
  return {
    lane,
    modelId: model.id,
    multiplier: model.mult,
    taskClass: classifyTask(prompt, policy.taskClasses),
    rollbackApplied
  };
}

module.exports = { resolveRouting, loadPolicy };
