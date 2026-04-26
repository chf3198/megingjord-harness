#!/usr/bin/env node
'use strict';
// Cascade dispatch: Ollama → heuristic gate → judge gate → escalation signal.

const { chatComplete: ollamaChat, healthCheck } = require('./ollama-direct');
const { recordTelemetry } = require('./model-routing-telemetry');
const { getProfile } = require('./fleet-config');
const { judgeResponse } = require('./local-judge');
const policy = require('./model-routing-policy.json');

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
  if (h.expectsCode && !/`|function|def |class |=>|const |let |var /.test(content))
    return { pass: false, reason: 'no_code_structure' };
  if (h.expectsJson) {
    const m = content.match(/\{[\s\S]*\}|\[[\s\S]*\]/);
    if (!m) return { pass: false, reason: 'no_json_found' };
    try { JSON.parse(m[0]); } catch { return { pass: false, reason: 'invalid_json' }; }
  }
  return { pass: true, reason: 'ok' };
}

async function tryOllama(prompt, model) {
  const health = await healthCheck();
  if (!health.ok) return { ok: false, reason: 'ollama_unreachable', tier: 'local' };
  const result = await ollamaChat(prompt, { model, maxTokens: 1024 });
  if (!result.ok) return { ok: false, reason: result.error, tier: 'local' };
  return { ok: true, content: result.content, model: result.model, tier: 'local' };
}

async function cascade(prompt, opts = {}) {
  const model = opts.model || 'qwen2.5:7b-instruct';
  const h = hints(prompt);
  const start = Date.now();
  const local = await tryOllama(prompt, model);
  const latency = Date.now() - start;

  if (!local.ok) {
    recordTelemetry({ lane: 'fleet', model, outcome: 'fail', escalation: 'haiku',
      escalation_reason: local.reason, latency_ms: latency, execute: true });
    return { ok: false, tier: 'local', escalation_needed: true,
      suggested_tier: 'haiku', reason: local.reason };
  }

  const quality = assessQuality(local.content, h);
  if (!quality.pass) {
    recordTelemetry({ lane: 'fleet', model, outcome: 'escalate', escalation: 'haiku',
      quality_reason: quality.reason, response_length: local.content.length,
      latency_ms: latency, execute: true });
    return { ok: true, content: local.content, tier: 'local', confidence: 'low',
      escalation_needed: true, suggested_tier: 'haiku', quality_reason: quality.reason };
  }

  // Layer 2: judge gate (semantic quality, independent model)
  const jcfg = policy.judge;
  const j = jcfg?.enabled ? await judgeResponse(prompt, local.content, { threshold: jcfg.threshold }) : null;
  const judgePass = !j || !j.ok || j.decision === 'return';
  recordTelemetry({ lane: 'fleet', model, outcome: judgePass ? 'ok' : 'escalate',
    escalation: judgePass ? null : 'haiku', quality_reason: quality.reason,
    ...(j?.ok && { judge_model: j.judge_model, judge_score: j.judge_score, judge_decision: j.decision }),
    response_length: local.content.length, latency_ms: latency, execute: true });
  if (!judgePass)
    return { ok: true, content: local.content, tier: 'local', confidence: 'low',
      escalation_needed: true, suggested_tier: 'haiku', quality_reason: 'judge_low_score' };
  return { ok: true, content: local.content, tier: 'local', confidence: 'high',
    escalation_needed: false, model };
}

async function main() {
  const args = process.argv.slice(2);
  const prompt = args[args.indexOf('--prompt') + 1] || '';
  const model = args[args.indexOf('--model') + 1] || undefined;
  const json = args.includes('--json');
  if (!prompt) { console.error('--prompt required'); process.exit(1); }
  const profile = getProfile();
  if (profile.mode === 'solo') {
    const r = { ok: false, tier: 'local', escalation_needed: true,
      suggested_tier: 'haiku', reason: 'fleet_unavailable' };
    console.log(json ? JSON.stringify(r) : `escalation_needed=true reason=fleet_unavailable`);
    return;
  }
  const result = await cascade(prompt, { model });
  if (json) { console.log(JSON.stringify(result, null, 2)); return; }
  if (result.ok) console.log(result.content);
  if (result.escalation_needed)
    process.stderr.write(`[cascade] escalate→${result.suggested_tier}: ${result.reason || result.quality_reason}\n`);
}

if (require.main === module) main().catch(e => { console.error(e.message); process.exit(1); });
module.exports = { cascade, assessQuality, hints };
