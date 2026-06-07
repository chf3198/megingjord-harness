#!/usr/bin/env node
'use strict';
// tier: 3
// Cascade dispatch: Ollama → heuristic gate → judge gate → escalation signal.

const { chatComplete: ollamaChat, healthCheck } = require('./litellm-client');
const { recordTelemetry } = require('./model-routing-telemetry');
const { getProfile } = require('./fleet-config');
const { judgeResponse } = require('./local-judge');
const policy = require('./model-routing-policy.json');
const { backoff, isRateLimitError } = require('./backoff');
const { dispatchFreeCloud } = require('./free-cloud-dispatch'); // execute free $0 cloud on fleet-down
// (#2645) shared .env hydration shim — make provider keys visible for the free-cloud fallback (G3)
const { loadLocalEnvOnce } = require('./load-local-env');

// #2619: G3 lane-order. Availability failures (fleet down -> no answer) fail over to a
// free $0 cloud tier BEFORE any paid tier; capability failures (fleet answered but
// quality/judge inadequate) step up to paid haiku. suggested_tier is an advisory signal.
const AVAILABILITY_REASONS = new Set(['ollama_unreachable', 'fleet_unavailable', 'cascade_script_not_found']);
function escalationTier(reason) {
  if (!reason) return 'haiku';
  if (AVAILABILITY_REASONS.has(reason)) return 'free-cloud';
  // connection-style provider errors are availability failures too (no usable answer produced).
  if (/econnrefused|fetch failed|timeout|network|enotfound|socket hang|connect/i.test(String(reason))) return 'free-cloud';
  return 'haiku'; // quality_reason / judge_low_score / unknown -> capability step-up
}

function hints(prompt) {
  const t = prompt.toLowerCase();
  return {
    expectsCode: /```|function|def |class |import |require/.test(t),
    expectsJson: /json|object|array|\{|\[/.test(t) && !/explain|describe|what/.test(t),
    isLookup: /^(what|where|when|who|which|list|show|find|get)\b/.test(t.trim()),
  };
}

function assessQuality(content, h) {
  if (!content || content.trim().length < 30) return { pass: false, reason: 'too_short' };
  if (h.expectsCode && !/`|function|def |class |=>|const |let |var /.test(content)) return { pass: false, reason: 'no_code_structure' };
  if (h.expectsJson) {
    const m = content.match(/\{[\s\S]*\}|\[[\s\S]*\]/);
    if (!m) return { pass: false, reason: 'no_json_found' };
    try { JSON.parse(m[0]); } catch { return { pass: false, reason: 'invalid_json' }; }
  }
  return { pass: true, reason: 'ok' };
}

async function tryOllama(prompt, model, attempt = 0) {
  const health = await healthCheck();
  if (!health.ok) return { ok: false, reason: 'ollama_unreachable', tier: 'local' };
  const result = await ollamaChat(prompt, { model, maxTokens: 1024 });
  if (!result.ok) {
    if (isRateLimitError(result) && attempt < 3) {
      await backoff(attempt);
      return tryOllama(prompt, model, attempt + 1);
    }
    return { ok: false, reason: result.error, tier: 'local' };
  }
  return { ok: true, content: result.content, model: result.model, tier: 'local' };
}

async function cascade(prompt, opts = {}) {
  // (#2645) G3: hydrate provider keys for the free-cloud fallback
  if (!opts.env) loadLocalEnvOnce();
  const model = opts.model || 'qwen2.5:7b-instruct';
  const h = hints(prompt); const start = Date.now();
  const local = await tryOllama(prompt, model);
  const latency = Date.now() - start;

  if (!local.ok) {
    const esc = escalationTier(local.reason); // #2619: fleet-down -> free-cloud, not paid haiku
    if (esc === 'free-cloud' && opts.executeFreeCloud !== false) {
      // #2621: actually execute a $0 cloud provider; graceful fall-through to advisory signal.
      const fc = await dispatchFreeCloud(prompt, opts.freeCloud || {});
      if (fc.ok) {
        recordTelemetry({ lane: 'free-cloud', model: fc.provider, outcome: 'ok', escalation: null,
          escalation_reason: local.reason, latency_ms: Date.now() - start, execute: true });
        return { ok: true, content: fc.content, tier: 'free-cloud', confidence: 'medium',
          escalation_needed: false, provider: fc.provider };
      }
    }
    recordTelemetry({ lane: 'fleet', model, outcome: 'fail', escalation: esc,
      escalation_reason: local.reason, latency_ms: latency, execute: true });
    return { ok: false, tier: 'local', escalation_needed: true,
      suggested_tier: esc, reason: local.reason };
  }

  const quality = assessQuality(local.content, h);
  if (!quality.pass) {
    const esc = escalationTier(quality.reason); // capability failure -> haiku
    recordTelemetry({ lane: 'fleet', model, outcome: 'escalate', escalation: esc,
      quality_reason: quality.reason, response_length: local.content.length, latency_ms: latency, execute: true });
    return { ok: true, content: local.content, tier: 'local', confidence: 'low',
      escalation_needed: true, suggested_tier: esc, quality_reason: quality.reason };
  }

  const jcfg = policy.judge; // Layer 2: judge gate (semantic quality, independent model)
  const j = jcfg?.enabled ? await judgeResponse(prompt, local.content, { threshold: jcfg.threshold, judgeModel: jcfg.model }) : null;
  const judgePass = !j || !j.ok || j.decision === 'return';
  const judgeEsc = escalationTier('judge_low_score'); // capability failure -> haiku
  recordTelemetry({ lane: 'fleet', model, outcome: judgePass ? 'ok' : 'escalate',
    escalation: judgePass ? null : judgeEsc, quality_reason: quality.reason,
    ...(j?.ok && { judge_model: j.judge_model, judge_score: j.judge_score,
      judge_decision: j.decision, judge_latency_ms: j.latency_ms }),
    response_length: local.content.length, latency_ms: latency, execute: true });
  if (!judgePass)
    return { ok: true, content: local.content, tier: 'local', confidence: 'low',
      escalation_needed: true, suggested_tier: judgeEsc, quality_reason: 'judge_low_score' };
  return { ok: true, content: local.content, tier: 'local', confidence: 'high',
    escalation_needed: false, model };
}

async function main() {
  const args = process.argv.slice(2);
  const prompt = args[args.indexOf('--prompt') + 1] || '';
  const model = args[args.indexOf('--model') + 1] || undefined;
  const json = args.includes('--json');
  if (!prompt) { console.error('--prompt required'); process.exit(1); }
  if (getProfile().mode === 'solo') {
    const soloResult = { ok: false, tier: 'local', escalation_needed: true, suggested_tier: escalationTier('fleet_unavailable'), reason: 'fleet_unavailable' };
    console.log(json ? JSON.stringify(soloResult) : `escalation_needed=true reason=fleet_unavailable suggested_tier=${soloResult.suggested_tier}`);
    return;
  }
  const result = await cascade(prompt, { model });
  if (json) return console.log(JSON.stringify(result, null, 2));
  if (result.ok) console.log(result.content);
  if (result.escalation_needed) process.stderr.write(`[cascade] escalate→${result.suggested_tier}: ${result.reason || result.quality_reason}\n`);
}

if (require.main === module) main().catch(e => { console.error(e.message); process.exit(1); });
module.exports = { cascade, assessQuality, hints, escalationTier };
