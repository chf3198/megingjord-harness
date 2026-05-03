#!/usr/bin/env node
'use strict';
/** Token telemetry reconciliation + drift alerting. Refs #774 */
const path = require('path');
const fs = require('fs');
const { buildTokenTelemetryReport } = require('./token-telemetry-report');

const REPORT_FILE = path.join(__dirname, '..', '..', 'logs', 'token-telemetry-reconcile.json');
const DEFAULT_THRESHOLDS = { drift_pct: 0.15, drift_pct_fail: 0.35, min_samples: 3 };

function loadEnv() {
  try { require('dotenv').config({ path: path.join(__dirname, '..', '..', '.env') }); } catch {}
}

async function fetchProviderAggregate(provider) {
  loadEnv();
  if (provider === 'openrouter') {
    const key = process.env.OPENROUTER_API_KEY;
    if (!key) return { ok: false, reason: 'no_key', usage_tokens: null };
    try {
      const r = await fetch('https://openrouter.ai/api/v1/auth/key', { headers: { Authorization: `Bearer ${key}` } });
      const d = await r.json();
      return { ok: true, usage_tokens: d.data?.usage ?? null };
    } catch (e) { return { ok: false, reason: e.message, usage_tokens: null }; }
  }
  if (provider === 'groq') {
    const key = process.env.GROQ_API_KEY;
    if (!key) return { ok: false, reason: 'no_key', usage_tokens: null };
    try {
      const r = await fetch('https://api.groq.com/openai/v1/models', { headers: { Authorization: `Bearer ${key}` } });
      return { ok: r.ok, usage_tokens: null, status: r.status };
    } catch (e) { return { ok: false, reason: e.message, usage_tokens: null }; }
  }
  return { ok: false, reason: 'no_aggregate_api', usage_tokens: null };
}

function verdictForDrift(drift, cfg) {
  if (drift === null) return 'UNREACHABLE';
  if (drift >= cfg.drift_pct_fail) return 'FAIL';
  if (drift >= cfg.drift_pct) return 'WARN';
  return 'OK';
}

async function buildReconciliationReport(days = 30, thresholds = {}) {
  const cfg = { ...DEFAULT_THRESHOLDS, ...thresholds };
  const summary = buildTokenTelemetryReport(days);
  const alerts = [], verdicts = [];

  for (const row of summary.providers) {
    if (row.samples < cfg.min_samples) {
      verdicts.push({ provider: row.provider, verdict: 'SKIP', reason: 'insufficient_samples' });
      continue;
    }
    const agg = await fetchProviderAggregate(row.provider);
    const drift = (agg.ok && agg.usage_tokens != null)
      ? +Math.abs(row.total_tokens - agg.usage_tokens) / agg.usage_tokens
      : null;
    const verdict = agg.ok ? verdictForDrift(drift, cfg) : 'UNREACHABLE';
    verdicts.push({ provider: row.provider, verdict, local_tokens: row.total_tokens,
      remote_tokens: agg.usage_tokens, drift_pct: drift != null ? +drift.toFixed(4) : null, agg_ok: agg.ok });
    if (verdict === 'FAIL' || verdict === 'WARN') {
      alerts.push({ provider: row.provider, verdict, drift_pct: +drift.toFixed(4) });
    }
  }
  return {
    generated_at: new Date().toISOString(), period_days: days, thresholds: cfg,
    summary_samples: summary.samples, verdicts, alerts,
    overall: alerts.some(a => a.verdict === 'FAIL') ? 'FAIL' : alerts.length ? 'WARN' : 'OK',
  };
}

async function writeReconciliationReport(days = 30, thresholds = {}) {
  fs.mkdirSync(path.dirname(REPORT_FILE), { recursive: true });
  const report = await buildReconciliationReport(days, thresholds);
  fs.writeFileSync(REPORT_FILE, JSON.stringify(report, null, 2) + '\n');
  return report;
}

if (require.main === module) {
  const args = process.argv.slice(2);
  const dIdx = args.indexOf('--days');
  const days = Number(dIdx >= 0 ? (args[dIdx + 1] || 30) : 30);
  writeReconciliationReport(days).then(r => console.log(JSON.stringify(r, null, 2)));
}

module.exports = { buildReconciliationReport, writeReconciliationReport, REPORT_FILE, DEFAULT_THRESHOLDS };
