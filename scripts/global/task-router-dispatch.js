#!/usr/bin/env node
'use strict';
const { classifyPrompt } = require('./task-router');
const { chatComplete: ollamaChat } = require('./ollama-direct');
const { getProfile } = require('./fleet-config');
const { resolveRouting } = require('./model-routing-engine');
const { recordTelemetry } = require('./model-routing-telemetry');
const { recordCostEvent } = require('./cost-telemetry');
const { compactPrompt, scopeContext } = require('./token-spend-controls');
const { keyFromRequest, getCached, putCached } = require('./token-spend-cache');
const policy = require('./model-routing-policy.json');

const args = process.argv.slice(2);
const prompt = (args[args.indexOf('--prompt') + 1]) || '';
const modelIdx = args.indexOf('--model');
const model = modelIdx !== -1 ? args[modelIdx + 1] : undefined;
const json = args.includes('--json');

function resolveFleetUrl(route) {
  const primary = policy.fleetTargets?.primary;
  if (primary?.ollamaUrl) return primary.ollamaUrl;
  return route.targetOllamaUrl || process.env.OLLAMA_URL || 'http://100.91.113.16:11434';
}

async function tryOllama(targetUrl, selectedModel) {
  try {
    return await ollamaChat(global.__dispatchPrompt || prompt, { model: selectedModel, ollamaUrl: targetUrl });
  } catch { return { ok: false, error: 'exception' }; }
}

async function buildDecision(route, resolved, cacheKey) {
  if (resolved.lane === 'free') return { action: 'stay-auto', reason: 'lowest adequate lane' };
  if (resolved.lane === 'fleet') {
    const profile = getProfile();
    if (profile.mode === 'solo') return { action: 'fleet-solo-fallback', reason: 'No fleet nodes reachable' };
    if (!prompt) return { action: 'route-fleet', reason: 'no prompt to dispatch' };
    const selectedModel = model || resolved.modelId || route.recommendedModel;
    const cached = getCached(cacheKey);
    if (cached?.value?.content) return { action: 'dispatched-cache-hit', chat: { ok: true, content: cached.value.content }, cacheHit: true };
    const primaryUrl = resolveFleetUrl(route);
    let chat = await tryOllama(primaryUrl, selectedModel);
    if (!chat.ok && policy.fleetTargets?.fallback?.ollamaUrl) chat = await tryOllama(policy.fleetTargets.fallback.ollamaUrl, selectedModel);
    if (!chat.ok) return { action: 'fleet-unavailable', reason: chat.error };
    putCached(cacheKey, { content: chat.content, lane: resolved.lane, model: selectedModel });
    return { action: 'dispatched-fleet', chat, targetUrl: primaryUrl };
  }
  if (resolved.lane === 'haiku') return { action: 'recommend-haiku', reason: 'mid-complexity haiku lane (0.3–0.7)' };
  return { action: 'recommend-sonnet', reason: 'premium lane' };
}

async function main() {
  const route = classifyPrompt(prompt);
  const resolved = resolveRouting(prompt, route);
  const prep = compactPrompt(prompt, resolved.lane);
  global.__dispatchPrompt = prep.prompt;
  const scope = scopeContext(resolved.lane);
  const cacheKey = keyFromRequest({ lane: resolved.lane, model: model || resolved.modelId, prompt: prep.prompt, scope: scope.sha256 });
  const effectiveRoute = { ...route, lane: resolved.lane, recommendedModel: resolved.modelId };
  const decision = await buildDecision(effectiveRoute, resolved, cacheKey);
  const outcome = decision.action === 'fleet-unavailable' ? 'fail' : 'ok';
  recordTelemetry({ lane: resolved.lane, model: resolved.modelId, multiplier: resolved.multiplier,
    taskClass: resolved.taskClass, complexityScore: route.complexity ?? null,
    rollbackApplied: resolved.rollbackApplied, outcome, execute: true });
  recordCostEvent(resolved.lane, resolved.modelId, {
    outcome, cacheHit: !!decision.cacheHit, scopeTier: scope.tier,
    promptCharsRaw: prep.stats.rawChars, promptCharsSent: prep.stats.sentChars,
    service: 'task-router-dispatch', sessionClass: resolved.taskClass,
  });
  const result = { route: effectiveRoute, routing: resolved, decision, scope, promptStats: prep.stats };
  if (json) console.log(JSON.stringify(result, null, 2));
  else {
    console.log(`lane=${effectiveRoute.lane}`);
    console.log(`backend=${effectiveRoute.backend}`);
    console.log(`action=${decision.action}`);
    if (decision.chat?.ok) console.log('\n' + decision.chat.content);
    if (decision.chat && !decision.chat.ok) console.error('Fleet error:', decision.chat.error);
  }
  process.exit(decision.action === 'fleet-unavailable' ? 1 : 0);
}

main().catch(e => { console.error(e.message); process.exit(1); });
