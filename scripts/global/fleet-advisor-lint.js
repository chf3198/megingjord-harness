/**
 * Fleet Advisor — Layer-① deterministic lint engine (Epic #3414, Phase-0 #3415 §3.1).
 *
 * A pure-function fleet audit: it takes a normalized, read-only probe of the fleet, builds a
 * collision-safe fingerprint, classifies the fleet-configuration tier F0→F4 (degrade-safe:
 * ambiguous signals classify to the LOWER tier), computes a flat signal map, and evaluates the
 * data-driven rule table (config/fleet-advisor-rules.yml). It is offline-safe and never throws:
 * a dead host is a *finding*, not a crash. $0 — no tokens, no network beyond the injected probe.
 *
 * The engine holds NO detection policy inline — every "known-known" lives in the YAML rule table;
 * this file only computes the signals those rules key on. Downstream children (#3481 AI pass,
 * #3482 IT contract, #3483 trigger, #3485 observability) consume `runLint()`'s report shape.
 */
'use strict';

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const DEFAULT_RULES_PATH = path.join(__dirname, '..', '..', 'config', 'fleet-advisor-rules.yml');

// VRAM thresholds (MB). A host below SMALL_GPU only runs ≤8B usefully → F1; a host at or above
// RESIDENT_32B can hold a 32B GPU-resident → F4-capable. Between the two is a discrete-GPU F2 host.
const SMALL_GPU_MB = 6000;
const RESIDENT_32B_MB = 24000;
const ENGINE_STALE_MINOR_RELEASES = 3;
const TELEMETRY_STALE_MS = 7 * 24 * 60 * 60 * 1000;
const TIER_ORDER = ['F0', 'F1', 'F2', 'F3', 'F4'];

/** Load + parse the YAML rule table. Returns { version, rules: [...] }. */
function loadRules(rulesPath = DEFAULT_RULES_PATH) {
  const yaml = require('js-yaml');
  const doc = yaml.load(fs.readFileSync(rulesPath, 'utf8')) || {};
  const rules = Array.isArray(doc.rules) ? doc.rules : [];
  return { version: doc.version || 0, rules };
}

/** Short stable digest of a string (fingerprint building block). */
function digest(text) {
  return crypto.createHash('sha256').update(String(text)).digest('hex').slice(0, 12);
}

/** Bucket VRAM into a coarse, collision-stable band so tiny probe noise doesn't churn the fingerprint. */
function vramBucket(mb) {
  if (!mb || mb <= 0) return 'none';
  if (mb < SMALL_GPU_MB) return 'tiny';
  if (mb < RESIDENT_32B_MB) return 'discrete';
  return 'dedicated';
}

/** True when a resident/model entry is CPU-offloaded (some of its weights are not in VRAM). */
function isCpuOffloaded(model) {
  if (!model || typeof model.sizeBytes !== 'number') return false;
  const vram = typeof model.sizeVramBytes === 'number' ? model.sizeVramBytes : 0;
  return vram < model.sizeBytes;
}

/**
 * Build the collision-safe fleet fingerprint (AC2). Keyed on host ids, per-host roster digests,
 * VRAM bucket, engine name+version, and the dispatch config — the axes that, when unchanged,
 * mean "nothing to re-advise" (drives the #3483 0-token skip).
 */
function buildFingerprint(probe) {
  const hosts = Array.isArray(probe && probe.hosts) ? probe.hosts : [];
  const hostPrints = hosts.map((h) => {
    const roster = (Array.isArray(h.models) ? h.models : [])
      .map((m) => `${m.name}:${m.quant || '?'}:${m.sizeBytes || 0}`)
      .sort()
      .join(',');
    return {
      id: h.id || h.url || 'unknown',
      reachable: Boolean(h.reachable),
      engine: h.engine ? `${h.engine.name || '?'}@${h.engine.version || '?'}` : 'none',
      vramBucket: vramBucket(h.gpu && h.gpu.vramTotalMb),
      rosterDigest: digest(roster || 'empty'),
    };
  });
  const dispatch = (probe && probe.dispatch) || {};
  const dispatchPrint = digest(JSON.stringify({
    keepAlive: Boolean(dispatch.keepAliveSet),
    stakes: Boolean(dispatch.stakesGate),
    hosts: (dispatch.hostList || []).slice().sort(),
  }));
  const fingerprint = {
    hosts: hostPrints,
    dispatchPrint,
    toolUse: probe && probe.toolUse ? Boolean(probe.toolUse.configured) : false,
  };
  fingerprint.hash = digest(JSON.stringify(fingerprint));
  return fingerprint;
}

/**
 * Classify the fleet tier F0→F4 from the probe (AC1). Degrade-safe: when signals are ambiguous or
 * VRAM is unknown/estimated, classify to the LOWER tier and flag `ambiguous` — under-claim capacity,
 * never over-claim. A dead/absent fleet is F0 (a valid, advised state), not an error.
 */
function classifyTier(probe) {
  const hosts = Array.isArray(probe && probe.hosts) ? probe.hosts : [];
  const reachable = hosts.filter((h) => h && h.reachable);
  if (reachable.length === 0) return { tier: 'F0', ambiguous: false, note: 'no reachable host — pure-cloud posture' };

  const gpuCapable = reachable.filter((h) => h.gpu && (h.gpu.vramTotalMb || 0) >= SMALL_GPU_MB);
  const vramUnknown = reachable.some((h) => !h.gpu || typeof h.gpu.vramTotalMb !== 'number');
  if (gpuCapable.length === 0) {
    return { tier: 'F1', ambiguous: vramUnknown, note: 'reachable host(s) but no GPU-resident-capable VRAM detected' };
  }
  const maxVram = Math.max(...gpuCapable.map((h) => h.gpu.vramTotalMb || 0));
  const dedicated = maxVram >= RESIDENT_32B_MB;

  let tier;
  if (reachable.length >= 2) tier = dedicated ? 'F4' : 'F3';
  else tier = dedicated ? 'F4' : 'F2';

  // Degrade-safe: if VRAM is estimated (unknown on any reachable host) and we'd otherwise claim
  // the dedicated F4 tier, step down one tier and flag the ambiguity.
  if (vramUnknown && tier === 'F4') {
    tier = reachable.length >= 2 ? 'F3' : 'F2';
    return { tier, ambiguous: true, note: 'VRAM estimated; stepped down from F4 (degrade-safe under-claim)' };
  }
  return { tier, ambiguous: vramUnknown, note: `${reachable.length} reachable host(s), max VRAM bucket ${vramBucket(maxVram)}` };
}

/** Read a dot-path (e.g. "dispatch.keepAliveMissing") out of the signal map. */
function readSignal(signals, dotPath) {
  return dotPath.split('.').reduce((acc, key) => (acc == null ? undefined : acc[key]), signals);
}

/**
 * Compute the flat signal map the rule table keys on. Every value is derived deterministically from
 * the probe; a missing probe field yields a safe default (no false-positive finding).
 */
function computeSignals(probe, tierInfo, opts = {}) {
  const now = typeof opts.now === 'number' ? opts.now : Date.parse((probe && probe.now) || '') || 0;
  const hosts = Array.isArray(probe && probe.hosts) ? probe.hosts : [];
  const reachable = hosts.filter((h) => h && h.reachable);
  const dispatch = (probe && probe.dispatch) || {};
  const policy = (probe && probe.policy) || {};
  const toolUse = (probe && probe.toolUse) || {};
  const telemetry = (probe && probe.telemetry) || {};
  const cloud = (probe && probe.cloud) || {};

  const allModels = reachable.flatMap((h) => (Array.isArray(h.models) ? h.models : []));
  const residentModels = reachable.flatMap((h) => (Array.isArray(h.ps) ? h.ps : []));
  const hotPathModels = dispatch.hotPathModels || [];
  const hotPathSpill = residentModels.concat(allModels)
    .filter((m) => hotPathModels.length === 0 || hotPathModels.includes(m.name))
    .some(isCpuOffloaded);
  const maxVram = Math.max(0, ...reachable.map((h) => (h.gpu && h.gpu.vramTotalMb) || 0));
  const hasStrongResident = allModels.some(
    (m) => /(-32b|-70b|:32b|:70b|coder:32b)/i.test(m.name) && !isCpuOffloaded(m),
  );
  const enginesInstalled = new Set(reachable.map((h) => h.engine && h.engine.name).filter(Boolean));
  const batchingEngineInstalled = ['vllm', 'tgi', 'text-generation-inference'].some((e) => enginesInstalled.has(e));
  const usingBatchingForAgentic = Boolean(dispatch.usesBatchingEngine);

  return {
    dispatch: {
      keepAliveMissing: dispatch.keepAliveSet === false || dispatch.keepAliveSet === undefined,
    },
    warm: {
      hotModelNotResident: hotPathModels.length > 0 && !residentModels.some((m) => hotPathModels.includes(m.name)),
    },
    offload: { hotPathCpuSpill: hotPathSpill },
    hosts: {
      policyHostUnreachable: (policy.hosts || []).some(
        (ph) => !reachable.some((h) => h.id === ph || h.url === ph),
      ),
      singleHostButLoadBalanceImplied: reachable.length === 1 && Boolean(policy.loadBalanceImplied),
    },
    roster: { noGpuResidentStrongModel: maxVram >= RESIDENT_32B_MB && !hasStrongResident },
    quant: {
      largerThanBestFit: allModels.some(
        (m) => isCpuOffloaded(m) && maxVram > 0 && (m.sizeBytes || 0) > maxVram * 1024 * 1024,
      ),
    },
    stakes: {
      noGateThirtyTwoBOnCommonPath:
        tierInfo.tier !== 'F0' && tierInfo.tier !== 'F1' && dispatch.stakesGate !== true,
    },
    tool: {
      agenticDisabledOrUnhealthy: toolUse.configured !== true || toolUse.healthy === false,
    },
    engine: {
      versionStale: reachable.some((h) => ((h.engine && h.engine.minorReleasesBehind) || 0) >= ENGINE_STALE_MINOR_RELEASES),
      higherThroughputEngineUnused: batchingEngineInstalled && !usingBatchingForAgentic,
    },
    obs: {
      noTelemetrySevenDays: !telemetry.lastEmitMs || (now > 0 && now - telemetry.lastEmitMs > TELEMETRY_STALE_MS),
    },
    fault: {
      recentTransient: reachable.some((h) => Array.isArray(h.recentFaults) && h.recentFaults.length > 0),
    },
    cloud: {
      noFreeProvidersWired: (tierInfo.tier === 'F0' || tierInfo.tier === 'F1') && cloud.freeProvidersWired !== true,
    },
  };
}

/** A rule applies to a tier when its `tiers` list is "*" or contains the tier. */
function ruleAppliesToTier(rule, tier) {
  const tiers = rule.tiers;
  if (!tiers || tiers === '*') return true;
  return Array.isArray(tiers) ? tiers.includes(tier) : tiers === tier;
}

/**
 * Evaluate the rule table against the computed signals for the classified tier. Returns findings
 * ordered by severity (high→low). A rule fires when its signal equals `expect` (default true) AND
 * the rule applies to the current tier.
 */
function evaluateRules(signals, tierInfo, rules) {
  const sevRank = { high: 0, med: 1, low: 2, informational: 3 };
  const findings = [];
  for (const rule of rules) {
    if (!ruleAppliesToTier(rule, tierInfo.tier)) continue;
    const expect = Object.prototype.hasOwnProperty.call(rule, 'expect') ? rule.expect : true;
    const actual = readSignal(signals, rule.signal);
    if (actual === expect) {
      findings.push({
        id: rule.id,
        severity: rule.severity,
        class: rule.class,
        title: rule.title,
        recommendation: rule.recommendation,
        source: 'lint',
      });
    }
  }
  findings.sort((a, b) => (sevRank[a.severity] ?? 9) - (sevRank[b.severity] ?? 9) || a.id.localeCompare(b.id));
  return findings;
}

/** Run `fn`; on any throw return `fallback` (one bad probe never aborts the run — G6). */
function safe(fn, fallback) {
  try {
    return fn();
  } catch (err) {
    if (fallback && typeof fallback === 'object' && !Array.isArray(fallback)) {
      return Object.assign({ probeError: err.message }, fallback);
    }
    return fallback;
  }
}

/**
 * Orchestrate a full deterministic lint run. `probe` is the normalized read-only fleet probe
 * (real probing lives in #3483's trigger + a probe adapter; here it is injected for purity/testing).
 * Never throws: any per-probe error surfaces as a `probe-error` finding while other work continues.
 */
function runLint(probe, opts = {}) {
  const rulesPath = opts.rulesPath || DEFAULT_RULES_PATH;
  let ruleset;
  try {
    ruleset = loadRules(rulesPath);
  } catch (err) {
    return {
      tier: 'F0',
      fingerprint: { hash: 'unavailable' },
      findings: [{ id: 'probe-error', severity: 'low', class: 'informational', title: `rule table unreadable: ${err.message}`, source: 'lint' }],
      ambiguous: true,
      generatedAtMs: typeof opts.now === 'number' ? opts.now : 0,
    };
  }
  const tierInfo = safe(() => classifyTier(probe), { tier: 'F0', ambiguous: true, note: 'probe error' });
  const fingerprint = safe(() => buildFingerprint(probe), { hash: 'unavailable' });
  const signals = safe(() => computeSignals(probe, tierInfo, opts), {});
  const findings = safe(() => evaluateRules(signals, tierInfo, ruleset.rules), []);
  return {
    tier: tierInfo.tier,
    tierNote: tierInfo.note,
    ambiguous: Boolean(tierInfo.ambiguous),
    fingerprint,
    findings,
    ruleTableVersion: ruleset.version,
    generatedAtMs: typeof opts.now === 'number' ? opts.now : 0,
  };
}

module.exports = {
  runLint,
  buildFingerprint,
  classifyTier,
  computeSignals,
  evaluateRules,
  loadRules,
  vramBucket,
  isCpuOffloaded,
  DEFAULT_RULES_PATH,
  TIER_ORDER,
  SMALL_GPU_MB,
  RESIDENT_32B_MB,
};
