#!/usr/bin/env node
'use strict';
const fs = require('fs');
const path = require('path');
const os = require('os');
const { readTelemetry, summarize } = require('./model-routing-telemetry');

const FILE = path.join(__dirname, 'model-routing-policy.json');
const ADAPTER_FILE = path.join(__dirname, 'routing-provider-adapters.json');
const POLICY_OVERRIDES = path.join(os.homedir(), '.megingjord', 'cascade-policy-overrides.json');
const PROMPT_HINT_MAX_LENGTH = 160;

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
    const scoreValue = score(text, classes[k]);
    if (scoreValue > top) { top = scoreValue; best = k; }
  }
  return best;
}

function normalizePremiumRationale(route, prompt, taskClass, complexity) {
  const provided = route.premiumRationale;
  if (provided && provided.reason && provided.evidence) {
    return { reason: String(provided.reason), evidence: String(provided.evidence) };
  }
  const promptHint = String(prompt || '').slice(0, PROMPT_HINT_MAX_LENGTH) || 'no prompt context';
  return {
    reason: `task_class=${taskClass}; complexity=${Number(complexity ?? 0).toFixed(2)}`,
    evidence: promptHint,
  };
}

function getPolicyDefaults(policy) {
  const budget = policy.premiumBudget || {};
  return {
    softLimit: budget.softLimitShare ?? 0.11,
    hardLimit: budget.hardLimitShare ?? 0.12,
    windowDays: budget.windowDays || 30,
  };
}

function computePremiumShare(route, windowDays) {
  return Number.isFinite(route.premiumShare30d)
    ? Number(route.premiumShare30d)
    : summarize(readTelemetry(windowDays)).premiumShare;
}

function decidePremiumDowngrade(premiumShare, softLimit, hardLimit) {
  if (premiumShare >= hardLimit) {
    return { downgraded: true, reason: 'premium_budget_hard_limit' };
  }
  if (premiumShare >= softLimit) {
    return { downgraded: true, reason: 'premium_budget_soft_limit' };
  }
  return { downgraded: false, reason: null };
}

function resolvePremiumBudget(policy, route, lane) {
  const disabled = route.disablePremiumBudget === true;
  if (lane !== 'premium' || disabled) {
    const { softLimit, hardLimit } = getPolicyDefaults(policy);
    return { enabled: !disabled, downgraded: false, premiumShare30d: null,
      downgradeReason: null, softLimit, hardLimit };
  }
  const { softLimit, hardLimit, windowDays } = getPolicyDefaults(policy);
  const premiumShare30d = computePremiumShare(route, windowDays);
  const { downgraded, reason } = decidePremiumDowngrade(premiumShare30d, softLimit, hardLimit);
  return {
    enabled: true,
    downgraded,
    premiumShare30d,
    downgradeReason: reason,
    softLimit,
    hardLimit,
  };
}

function resolvePriceCap(route, lane, model) {
  const routeCap = Number(route.priceCapPer1kTokens);
  const cap = Number.isFinite(routeCap) ? routeCap : Number(model?.maxPriceCapPer1kTokens);
  const priced = Number(model?.costPer1kTokens);
  const laneIsPaid = lane === 'haiku' || lane === 'premium';
  const hasCap = laneIsPaid && Number.isFinite(cap) && cap > 0;
  const overCap = hasCap && Number.isFinite(priced) && priced > cap;
  const override = route.priceCapOverride === true || process.env.MEGINGJORD_PRICE_CAP_OVERRIDE === '1';
  return {
    priceCapPer1kTokens: hasCap ? cap : null,
    routePricePer1kTokens: Number.isFinite(priced) ? priced : null,
    priceCapBlocked: Boolean(overCap && !override),
    priceCapOverride: override,
  };
}

function shouldRollback(policy) {
  const rb = policy.rollback || {};
  if (!rb.enabled) return false;
  const stats = summarize(readTelemetry(rb.windowDays || 7));
  if (stats.samples < 5) return false;
  return stats.successRate < (rb.minSuccessRate ?? 0.75) ||
    stats.premiumShare > (rb.maxPremiumShare ?? 0.45);
}

function classifyLane(lane, complexity, thresholds) {
  const thresh = thresholds || {};
  if (lane === 'premium' && complexity < (thresh.premium ?? 0.7)) {
    return complexity < (thresh.haiku ?? 0.3) ? 'fleet' : 'haiku';
  }
  return lane;
}

function assembleRouting(lane, adapter, model, taskClass, rollbackApplied, cx, premiumRationale,
    budgetStatus, capStatus, overrides) {
  return {
    lane,
    modelId: adapter.capabilityTier || model.id,
    providerModelId: adapter.defaultModelId || model.id,
    providerPath: adapter.defaultProvider || model.endpoint || null,
    adapterId: adapter.defaultAdapter || null,
    multiplier: model.mult,
    taskClass,
    rollbackApplied,
    complexity: cx,
    premiumRationale,
    premiumBudget: budgetStatus,
    priceCapPer1kTokens: capStatus.priceCapPer1kTokens,
    routePricePer1kTokens: capStatus.routePricePer1kTokens,
    priceCapBlocked: capStatus.priceCapBlocked,
    priceCapOverride: capStatus.priceCapOverride,
    overridesApplied: overrides !== null,
    overridesStale: overrides?.stale ?? false,
  };
}

function resolveRouting(prompt, route) {
  const policy = loadPolicy();
  const rollbackApplied = route.disableRollback ? false : shouldRollback(policy);
  let lane = rollbackApplied ? policy.rollback.forceLane : route.lane;
  const cx = route.complexity ?? 0.5;
  const taskClass = classifyTask(prompt, policy.taskClasses);
  lane = classifyLane(lane, cx, policy.complexityThresholds);
  const premiumRationale = lane === 'premium'
    ? normalizePremiumRationale(route, prompt, taskClass, cx)
    : null;
  const budgetStatus = resolvePremiumBudget(policy, route, lane);
  if (lane === 'premium' && budgetStatus.downgraded) lane = 'haiku';
  const model = policy.models[lane] || policy.models.fallback;
  const capStatus = resolvePriceCap(route, lane, model);
  const adapter = loadAdapters().lanes?.[lane] || {};
  const overrides = loadOverrides();
  return assembleRouting(lane, adapter, model, taskClass, rollbackApplied, cx, premiumRationale,
    budgetStatus, capStatus, overrides);
}

module.exports = { resolveRouting, loadPolicy, loadAdapters, loadOverrides };
