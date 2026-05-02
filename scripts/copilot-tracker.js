// Copilot Usage Tracker — local premium request estimator
// Tracks per-model multipliers since GitHub has no individual billing API
// Reset on 1st of each month (UTC). Manual sync from billing page.

const fs = require('fs');
const path = require('path');
const FILE = path.join(__dirname, '..', 'logs', 'copilot-usage.json');

const MONTHLY_BUDGET = 10.00; // dollars
const RATE_PER_UNIT = 0.04;   // $/premium-request-unit
const INCLUDED_BASE = 0;      // Pro metered: no free units

function loadUsage() {
  try {
    const data = JSON.parse(fs.readFileSync(FILE, 'utf8'));
    // Auto-reset on new month
    const now = new Date();
    const period = `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, '0')}`;
    if (data.period !== period) {
      return createFresh(period);
    }
    return data;
  } catch (e) {
    const now = new Date();
    const period = `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, '0')}`;
    return createFresh(period);
  }
}

function createFresh(period) {
  const data = {
    period, requests: 0, estimatedCost: 0,
    budget: MONTHLY_BUDGET, ratePerUnit: RATE_PER_UNIT,
    manualOverride: null, lastUpdated: new Date().toISOString()
  };
  saveUsage(data);
  return data;
}

function saveUsage(data) {
  const dir = path.dirname(FILE);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(FILE, JSON.stringify(data, null, 2));
}

/** Increment usage counter (called from hooks or manually) */
function addRequests(count = 1, costPerUnit = RATE_PER_UNIT) {
  const data = loadUsage();
  data.requests += count;
  data.estimatedCost = +(data.requests * costPerUnit).toFixed(2);
  data.lastUpdated = new Date().toISOString();
  saveUsage(data);
  return data;
}

/** Manual override from billing page (user enters actual value) */
function setManualUsage(cost, requests) {
  const data = loadUsage();
  if (cost != null) data.manualOverride = { cost: +cost, requests: +requests, at: new Date().toISOString() };
  saveUsage(data);
  return data;
}

/** Get quota summary for dashboard */
function getCopilotQuota() {
  const data = loadUsage();
  const cost = data.manualOverride?.cost ?? data.estimatedCost;
  const reqs = data.manualOverride?.requests ?? data.requests;
  const pct = Math.min(100, Math.round((cost / data.budget) * 100));
  return {
    id: 'copilot-pro', name: 'Copilot Pro (metered)',
    used: `$${cost.toFixed(2)}`, limit: `$${data.budget}`,
    requests: reqs, percent: pct, period: data.period,
    source: data.manualOverride ? 'manual' : 'estimated',
    budgetLink: 'https://github.com/settings/billing/budgets',
    usageLink: 'https://github.com/settings/billing/summary',
    note: pct >= 90 ? '🔴 Near budget!' : pct >= 75 ? '🟡 75%+ used' : null
  };
}

function getCopilotEstimatedRecord() {
  const data = loadUsage();
  const reqs = data.manualOverride?.requests ?? data.requests;
  const cost = data.manualOverride?.cost ?? data.estimatedCost;
  return {
    provider: 'copilot', model: 'copilot-pro', input_tokens: 0, output_tokens: 0,
    total_tokens: 0, cost_usd: Number(cost || 0), confidence_level: 'estimated',
    caveat_code: 'copilot_estimated_lane',
    caveat_detail: 'Copilot token counts are estimated/manual; no exact per-request API available.',
    source_kind: data.manualOverride ? 'copilot_manual_sync' : 'copilot_estimator',
    request_id: `${data.period}:${reqs}`
  };
}

module.exports = {
  loadUsage, addRequests, setManualUsage, getCopilotQuota, getCopilotEstimatedRecord
};
