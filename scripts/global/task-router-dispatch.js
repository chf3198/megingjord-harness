#!/usr/bin/env node
'use strict';
const { execSync } = require('child_process');
const { classifyPrompt } = require('./task-router');

const args = process.argv.slice(2);
const prompt = (args[args.indexOf('--prompt') + 1]) || '';
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

function buildDecision(route) {
  if (route.lane === 'free') {
    return { action: 'stay-auto', reason: 'lowest adequate lane selected' };
  }
  if (route.lane === 'fleet') {
    const preflight = execute
      ? safe('node scripts/global/openclaw-preflight.js --json')
      : { ok: true, out: 'dry-run: preflight skipped' };
    return { action: 'route-openclaw', preflight };
  }
  return {
    action: 'recommend-sonnet',
    reason: 'premium lane selected for quality/capability gain'
  };
}

const route = classifyPrompt(prompt);
const decision = buildDecision(route);
const result = { route, decision, execute };
if (json) console.log(JSON.stringify(result, null, 2));
else {
  console.log(`lane=${route.lane}`);
  console.log(`backend=${route.backend}`);
  console.log(`action=${decision.action}`);
}
process.exit(0);
