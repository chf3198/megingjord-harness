// leader-election.js — GitHub-label-based atomic leader claim (#2486 #2479)
// Pure functions; gh CLI invocation injected for testability.
'use strict';

const TEAM_NAMESPACE = 'xteam-lead:';
const VALID_TEAMS = ['antigravity', 'claude-code', 'codex', 'copilot', 'cursor'];

function leadLabel(team) {
  if (!VALID_TEAMS.includes(team)) {
    throw new Error(`unknown team: ${team}; valid: ${VALID_TEAMS.join(', ')}`);
  }
  return `${TEAM_NAMESPACE}${team}`;
}

function parseExistingLeads(labels) {
  return (labels || [])
    .map(l => (typeof l === 'string' ? l : l.name))
    .filter(name => name && name.startsWith(TEAM_NAMESPACE))
    .map(name => name.slice(TEAM_NAMESPACE.length));
}

async function attemptClaim({ ticket, team, ghClient }) {
  if (!Number.isInteger(ticket) || ticket <= 0) {
    throw new Error('ticket must be positive integer');
  }
  const label = leadLabel(team);
  const beforeLabels = await ghClient.viewLabels(ticket);
  const existingLeads = parseExistingLeads(beforeLabels);
  if (existingLeads.length > 0) {
    return { role: 'participant', leadTeam: existingLeads[0], reason: 'lead-already-claimed' };
  }
  await ghClient.addLabel(ticket, label);
  const afterLabels = await ghClient.viewLabels(ticket);
  const finalLeads = parseExistingLeads(afterLabels);
  if (finalLeads.length === 0) {
    throw new Error('claim race: label not present after add');
  }
  if (finalLeads.length === 1 && finalLeads[0] === team) {
    return { role: 'lead', leadTeam: team, reason: 'claimed' };
  }
  // Tiebreaker: alphabetical (stable, deterministic)
  const winner = [...finalLeads].sort()[0];
  if (winner === team) {
    return { role: 'lead', leadTeam: team, reason: 'tiebreaker-winner' };
  }
  await ghClient.removeLabel(ticket, label);
  return { role: 'participant', leadTeam: winner, reason: 'tiebreaker-loser' };
}

module.exports = {
  TEAM_NAMESPACE, VALID_TEAMS,
  leadLabel, parseExistingLeads, attemptClaim,
};
