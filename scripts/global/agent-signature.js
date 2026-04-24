#!/usr/bin/env node
'use strict';

const args = process.argv.slice(2);
const opt = {};
for (let i = 0; i < args.length; i += 2) {
  if (args[i]?.startsWith('--')) opt[args[i].slice(2)] = args[i + 1] || '';
}

const team = (opt.team || 'codex').toLowerCase();
const model = (opt.model || 'gpt-5.4').toLowerCase();
const role = (opt.role || 'collaborator').toLowerCase();
const substrate = (opt.substrate || 'local').toLowerCase();
const device = opt.device ? `/${opt.device}` : '';
const key = `${team}:${model}`;
const surnames = {
  manager: 'Mason', collaborator: 'Harper', admin: 'Reyes', consultant: 'Vale'
};

function firstName(value) {
  if (/codex:gpt-5\.4/.test(value)) return 'Quill';
  if (/codex:gpt-5.*codex/.test(value)) return 'Caden';
  if (/copilot:.*sonnet/.test(value)) return 'Soren';
  if (/copilot:.*opus/.test(value)) return 'Orion';
  if (/copilot:.*gpt-5.*mini/.test(value)) return 'Milo';
  if (/claude-code:.*sonnet/.test(value)) return 'Clio';
  if (/claude-code:.*opus/.test(value)) return 'Orla';
  if (/qwen/.test(value)) return 'Quinn';
  if (/mistral/.test(value)) return 'Mira';
  if (/phi/.test(value)) return 'Fia';
  if (/gemma/.test(value)) return 'Gemma';
  return 'Nova';
}

const payload = {
  signedBy: `${firstName(key)} ${surnames[role] || 'Harper'}`,
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
