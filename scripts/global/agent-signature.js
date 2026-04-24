#!/usr/bin/env node
'use strict';
const fs = require('fs');
const path = require('path');

const args = process.argv.slice(2);
const opt = {};
for (let i = 0; i < args.length; i += 2) {
  if (args[i]?.startsWith('--')) opt[args[i].slice(2)] = args[i + 1] || '';
}

const registry = JSON.parse(fs.readFileSync(
  path.join(__dirname, '..', '..', 'inventory', 'team-model-signatures.json'), 'utf8'
));
const team = (opt.team || 'codex').toLowerCase();
const model = (opt.model || 'gpt-5.4').toLowerCase();
const role = (opt.role || 'collaborator').toLowerCase();
const substrate = (opt.substrate || 'local').toLowerCase();
const deviceName = (opt.device || '').toLowerCase();
const device = deviceName ? `/${deviceName}` : '';

function match(entry) {
  const teamOk = entry.team === '*' || entry.team === team;
  const modelOk = new RegExp(entry.modelPattern, 'i').test(model);
  const deviceOk = !entry.devicePattern || new RegExp(entry.devicePattern, 'i').test(deviceName);
  return teamOk && modelOk && deviceOk;
}

const payload = {
  signedBy: `${registry.registry.find(match)?.aliasSeed || registry.defaultAliasSeed} ` +
    `${registry.roleSurnames[role] || registry.roleSurnames.collaborator}`,
  teamModel: `${team}:${model}@${substrate}${device}`,
  role
};

if (opt.format === 'text') {
  console.log(`Signed-by: ${payload.signedBy}`);
  console.log(`Team&Model: ${payload.teamModel}`);
  console.log(`Role: ${payload.role}`);
} else {
  console.log(JSON.stringify(payload, null, 2));
}
