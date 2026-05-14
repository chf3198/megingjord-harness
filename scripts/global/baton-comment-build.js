#!/usr/bin/env node
'use strict';
const { canonicalSignerAlias } = require('./signer-alias');

function arg(name, fallback = '') {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 ? (process.argv[i + 1] || '') : fallback;
}

function buildBatonComment({ artifact, ticket, role, teamModel, summary = '' }) {
  const [team = '', modelSub = ''] = String(teamModel || '').split(':');
  const model = (modelSub.split('@')[0] || '').trim();
  const signer = canonicalSignerAlias(team, role, model);
  const head = `## ${artifact}\n\n`;
  const scope = summary ? `scope: ${summary}\n\n` : '';
  const refs = ticket ? `ticket: #${ticket}\n\n` : '';
  const sig = `Signed-by: ${signer}\nTeam&Model: ${teamModel}\nRole: ${role}`;
  return `${head}${scope}${refs}${sig}`;
}

function main() {
  const artifact = arg('artifact', 'MANAGER_HANDOFF').toUpperCase();
  const role = arg('role', 'manager').toLowerCase();
  const teamModel = arg('team-model', process.env.TEAM_MODEL || '');
  const ticket = arg('ticket', '');
  const summary = arg('summary', '');
  if (!teamModel) {
    process.stderr.write('Missing --team-model (or TEAM_MODEL env).\n');
    process.exit(1);
  }
  console.log(buildBatonComment({ artifact, ticket, role, teamModel, summary }));
}

if (require.main === module) main();
module.exports = { buildBatonComment };
