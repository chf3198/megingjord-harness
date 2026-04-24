#!/usr/bin/env node
'use strict';
const { execSync } = require('child_process');
const { classifyPrompt } = require('./task-router');
const { chatComplete } = require('./openclaw-chat');
const { getProfile } = require('./fleet-config');
const { resolveRouting } = require('./model-routing-engine');
const { recordTelemetry } = require('./model-routing-telemetry');

const args = process.argv.slice(2);
const prompt = (args[args.indexOf('--prompt') + 1]) || '';
const modelIdx = args.indexOf('--model');
const model = modelIdx !== -1 ? args[modelIdx + 1] : undefined;
const json = args.includes('--json');
const execute = args.includes('--execute');

function safe(cmd) {
  try {
    const out = execSync(cmd, { encoding: 'utf8' }).trim();
    return { ok: true, out };
  } catch (e) {
    const out = (e.stdout || e.message || '').toString().trim();
    return { ok: false, out };
  }
}

async function buildDecision(route, resolved) {
  if (resolved.lane === 'free') {
    return { action: 'stay-auto', reason: 'lowest adequate lane' };
  }
  if (resolved.lane === 'fleet') {
    const profile = getProfile();
    if (profile.mode === 'solo') {
      return { action: 'fleet-solo-fallback', reason: 'No fleet nodes reachable — using cloud fallback' };
    }
    const preflight = execute
      ? safe('node scripts/global/openclaw-preflight.js --json')
      : { ok: true, out: 'dry-run: preflight skipped' };
    if (execute && !preflight.ok) {
      return { action: 'fleet-unavailable', preflight };
    }
    if (execute && prompt) {
      const selectedModel = model || resolved.modelId || route.recommendedModel;
      const chat = await chatComplete(prompt, { model: selectedModel });
      if (chat.ok) safe('node scripts/global/openclaw-lane-log.js record openclaw task-router');
      return { action: chat.ok ? 'dispatched-openclaw' : 'fleet-error', preflight, chat };
    }
    return { action: 'route-openclaw', preflight };
  }
  return { action: 'recommend-sonnet', reason: 'premium lane' };
}

async function main() {
  const route = classifyPrompt(prompt);
  const resolved = resolveRouting(prompt, route);
  const effectiveRoute = { ...route, lane: resolved.lane, recommendedModel: resolved.modelId };
  const decision = await buildDecision(effectiveRoute, resolved);
  const outcome = decision.action === 'fleet-error' || decision.action === 'fleet-unavailable' ? 'fail' : 'ok';
  recordTelemetry({ lane: resolved.lane, model: resolved.modelId, multiplier: resolved.multiplier,
    taskClass: resolved.taskClass, rollbackApplied: resolved.rollbackApplied, outcome, execute });
  const result = { route: effectiveRoute, routing: resolved, decision, execute };
  if (json) {
    console.log(JSON.stringify(result, null, 2));
  } else {
    console.log(`lane=${effectiveRoute.lane}`);
    console.log(`backend=${effectiveRoute.backend}`);
    console.log(`action=${decision.action}`);
    if (decision.chat?.ok) console.log('\n' + decision.chat.content);
    if (decision.chat && !decision.chat.ok) console.error('Fleet error:', decision.chat.error);
  }
  process.exit(decision.action === 'fleet-error' ? 1 : 0);
}

main().catch(e => { console.error(e.message); process.exit(1); });
