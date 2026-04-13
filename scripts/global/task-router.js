#!/usr/bin/env node
'use strict';
const fs = require('fs');
const path = require('path');

const policyPath = path.join(__dirname, 'task-router-policy.json');
const policy = JSON.parse(fs.readFileSync(policyPath, 'utf8'));

function score(prompt, list) {
  const text = String(prompt || '').toLowerCase();
  return list.reduce((sum, word) => sum + (text.includes(word) ? 1 : 0), 0);
}

function classifyPrompt(prompt) {
  const free = score(prompt, policy.lanes.free.keywords);
  const fleet = score(prompt, policy.lanes.fleet.keywords);
  const premium = score(prompt, policy.lanes.premium.keywords);
  const premiumBoost = score(prompt, policy.escalation.premiumOn);
  const fleetBoost = score(prompt, policy.escalation.fleetOn);
  const totals = {
    free,
    fleet: fleet + fleetBoost,
    premium: premium + premiumBoost
  };
  let lane = policy.defaultLane;
  if (totals.premium >= 2 && totals.premium >= totals.fleet) lane = 'premium';
  else if (totals.fleet >= 2) lane = 'fleet';
  const selected = policy.lanes[lane];
  const confidence = lane === 'free' && free < 2 ? 'medium' : 'high';
  return {
    lane,
    backend: selected.backend,
    recommendedModel: selected.recommendedModel,
    confidence,
    scores: totals,
    rationale: `${lane} selected from keyword score`,
    triggers: Object.entries(totals).filter(([, v]) => v > 0).map(([k]) => k)
  };
}

function runCli(argv) {
  const args = argv.slice(2);
  const json = args.includes('--json');
  const prompt = (args[args.indexOf('--prompt') + 1]) || '';
  const report = classifyPrompt(prompt);
  if (json) console.log(JSON.stringify(report, null, 2));
  else {
    console.log(`lane=${report.lane}`);
    console.log(`backend=${report.backend}`);
    console.log(`model=${report.recommendedModel}`);
    console.log(`confidence=${report.confidence}`);
    console.log(`rationale=${report.rationale}`);
  }
  return 0;
}

if (require.main === module) process.exit(runCli(process.argv));
module.exports = { classifyPrompt, runCli };
