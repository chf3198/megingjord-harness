// transport-mocks.js — demo mode overrides for ALL data-fetch globals
// Loads LAST (after all other scripts) to override function declarations.
/* eslint-disable no-unused-vars */
if (window.IS_DEMO) (function () {
  'use strict';
  const DEMO_K = { FLEET_CALLS: 187, TICKET: 2809, MS_60S: 60000, MS_30S: 30000, LATENCY_HIGH: 380, TOKENS_TODAY: 187400, PAID_TOKENS: 48800, RECONCILED: 183, MS_PER_DAY: 86400000, MS_2MIN: 120000 };
  const DEMO_TODAY = new Date().toISOString().slice(0, 10);
  const DEMO_YEST = new Date(Date.now() - DEMO_K.MS_PER_DAY).toISOString().slice(0, 10);
  const DEVICES = [
    { id: '36gbwinresource', alias: '36GB Windows Resource', role: 'primary-fleet-inference', ram: '32GB', modelCount: 6, tailscaleIP: '100.91.113.16', ollama: true, openclaw: false, local: false, status: 'healthy' },
    { id: 'windows-laptop', alias: 'OpenClaw Host', role: 'primary-inference', ram: '16GB', modelCount: 7, tailscaleIP: '100.78.22.13', ollama: true, openclaw: true, local: false, status: 'healthy' },
    { id: 'penguin-1', alias: 'SML Chromebook', role: 'sml-agent', ram: '2.7GB', modelCount: 4, tailscaleIP: '100.86.248.35', ollama: true, openclaw: false, local: false, status: 'degraded' },
    { id: 'chromebook-2', alias: 'Dev Chromebook', role: 'primary-dev', ram: '6.3GB', modelCount: 0, tailscaleIP: null, ollama: false, openclaw: false, local: true, status: 'healthy' },
  ];
  const SERVICES = [
    { id: 'github-copilot', name: 'GitHub Copilot', type: 'paid', cost: '$19/mo', status: 'active' },
    { id: 'openrouter',     name: 'OpenRouter',     type: 'paid', cost: 'metered', status: 'active' },
    { id: 'hamr-worker',    name: 'HAMR Worker',    type: 'free', cost: 'free',    status: 'active' },
  ];
  window.loadDevices  = async function () { return DEVICES; };
  window.loadServices = async function () { return SERVICES; };
  window.runHealthChecks = async function (devices) {
    return Object.fromEntries((devices || []).map(function (d) {
      if (d.local) return [d.id, { status: 'healthy' }];
      if (d.id === 'penguin-1') return [d.id, { status: 'degraded', models: ['qwen3.5:0.8b'] }];
      return [d.id, { status: 'healthy', models: d.id === '36gbwinresource'
        ? ['qwen3:32b', 'qwen2.5-coder:32b', 'starcoder2:3b'] : ['qwen2.5-coder:7b', 'deepseek-coder-v2:lite'] }];
    }));
  };
  window.mergeHealthStatus = function (devices, checks) {
    return (devices || []).map(function (d) { return Object.assign({}, d, checks[d.id] || {}); });
  };
  window.fetchAllFleetStats = async function () {
    return { '36gbwinresource': { tokPerSec: 80.5, activeModel: 'starcoder2:3b', utilPct: 42 },
             'windows-laptop':  { tokPerSec: 8.4,  activeModel: 'qwen2.5-coder:7b', utilPct: 18 },
             'penguin-1':       { tokPerSec: 12.1, activeModel: 'qwen3.5:0.8b', utilPct: 5 } };
  };
  window.fetchAllLiveQuotas   = async function () { return []; };
  window.pollEventBus         = async function () { return []; };
  window.fetchRouterLaneStats = async function () {
    return { fleet: { calls: DEMO_K.FLEET_CALLS, pct: 74 }, haiku: { calls: 41, pct: 16 }, premium: { calls: 26, pct: 10 }, free: { calls: 0, pct: 0 } };
  };
  window.fetchWikiHealth   = async function () { return { loaded: true, pages: 47, stale: 2 }; };
  window.fetchWikiMetrics  = async function () { return { total: 47, fresh: 45, stale: 2, avgTrust: 0.91 }; };
  window.pollGitHub        = async function () {
    return { issues: { open: 12, recent: [{ number: DEMO_K.TICKET, title: 'Phase-1 dashboard', state: 'open' }] }, pulls: { open: 1, merged: 3, recent: [] }, actions: { recent: [] }, branches: { count: 2, active: ['main', 'feat/dashboard-demo'] } };
  };
  window.fetchFleetHealthLog = async function () {
    return [ { ts: Date.now() - DEMO_K.MS_60S, node: '36gbwinresource', status: 'healthy', latencyMs: 12 },
             { ts: Date.now() - DEMO_K.MS_30S, node: 'windows-laptop',  status: 'healthy', latencyMs: 47 },
             { ts: Date.now(),                 node: 'penguin-1',        status: 'degraded', latencyMs: DEMO_K.LATENCY_HIGH } ];
  };
  window.fetchGovernanceState = async function () {
    return { ticketFirst: { status: 'pass', violations: 0 }, signerFidelity: { status: 'pass', violations: 0 },
             lintRequired: { status: 'pass', violations: 0 }, testEvidence: { status: 'pass', violations: 0 },
             lastChecked: new Date().toISOString() };
  };
  window.fetchCostTelemetry = async function () {
    return [{ date: DEMO_YEST, fleet: 0.00, paid: 0.14, sessions: 8 }, { date: DEMO_TODAY, fleet: 0.00, paid: 0.09, sessions: 5 }];
  };
  window.fetchTokenTelemetrySummary = async function () {
    return { todayTokens: DEMO_K.TOKENS_TODAY, fleetPct: 74, paidTokens: DEMO_K.PAID_TOKENS, fleetSavingsUsd: 0.19, paidSpendUsd: 0.23 };
  };
  window.fetchQualityParitySummary  = async function () { return { fleetPassRate: 0.94, paidPassRate: 0.97, delta: 0.03, judgeCalls: 42 }; };
  window.fetchGoalHealthSummary = async function () {
    return { G1: { score: 9, label: 'Governance' }, G2: { score: 8, label: 'Quality' },
             G3: { score: 9, label: 'Zero Cost' },  G4: { score: 8, label: 'Privacy' },
             G5: { score: 7, label: 'Portability' }, G6: { score: 8, label: 'Resilience' },
             G7: { score: 7, label: 'Throughput' },  G8: { score: 8, label: 'Observability' },
             G9: { score: 7, label: 'Interop' } };
  };
  window.fetchTokenReconcileSummary = async function () { return { matched: DEMO_K.RECONCILED, unmatched: 4, matchRate: 0.978 }; };
  window.fetchAgentSessions = async function () {
    return [{ id: 's1', agent: 'copilot', model: 'claude-sonnet-4.6', ticket: DEMO_K.TICKET, status: 'active', startTs: Date.now() - DEMO_K.MS_2MIN, costUsd: 0.0041 }];
  };
  window.buildQuotaList = function (services) {
    return (services || []).map(function (s) { return Object.assign({}, s, { used: 0, limit: null }); });
  };
})();
