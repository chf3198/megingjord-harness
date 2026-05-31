// handlers.js — /xteam prompt handlers (pure logic, MCP-server-agnostic)
// Each handler returns the chat-rendered prompt string for the caller.
'use strict';

const { attemptClaim } = require('./leader-election');

function loadPerspectives(perspectivesPath, fs = require('fs')) {
  return JSON.parse(fs.readFileSync(perspectivesPath, 'utf8')).teams;
}

function leadPrompt({ team, ticket, perspective, description }) {
  return `You are LEAD on Epic #${ticket}.
Your perspective: ${perspective.lens}
Your strengths: ${perspective.strengths.join(', ')}
Task: Coordinate cross-team synthesis. ${description ? 'Scope: ' + description : 'Read Epic body for scope.'}
Write findings to artifacts/${team}-rd.md. Lead the convergence + final synthesis.`;
}

function participantPrompt({ team, ticket, perspective, leadTeam }) {
  return `You are PARTICIPANT on Epic #${ticket}. Lead is ${leadTeam}.
Your perspective: ${perspective.lens}
Your strengths: ${perspective.strengths.join(', ')}
Task: Read Epic body. Write findings to artifacts/${team}-rd.md from your perspective.`;
}

async function handleXteam({ ticket, team, perspectivesPath, ghClient, fs }) {
  const teams = loadPerspectives(perspectivesPath, fs);
  const perspective = teams[team];
  if (!perspective) throw new Error(`unknown team: ${team}`);
  const claim = await attemptClaim({ ticket, team, ghClient });
  return claim.role === 'lead'
    ? { role: 'lead', prompt: leadPrompt({ team, ticket, perspective }), ticket }
    : { role: 'participant', prompt: participantPrompt({ team, ticket, perspective, leadTeam: claim.leadTeam }), ticket };
}

async function handleXteamCreate({ description, team, perspectivesPath, ghClient, fs }) {
  if (!description || description.trim().length < 10) {
    throw new Error('description must be at least 10 characters');
  }
  const epic = await ghClient.createEpic({
    title: description.slice(0, 60),
    body: `## Goal\n\n${description}\n\nCreated via /xteam ? by ${team}.`,
    labels: ['type:epic', 'status:backlog', 'priority:P2', 'lane:docs-research', 'phase-gate:research-first'],
  });
  return handleXteam({ ticket: epic.number, team, perspectivesPath, ghClient, fs });
}

async function handleXteamStatus({ ticket, ghClient }) {
  const labels = await ghClient.viewLabels(ticket);
  const { parseExistingLeads } = require('./leader-election');
  const leads = parseExistingLeads(labels);
  return { ticket, leadTeam: leads[0] || null, status: leads.length > 0 ? 'in-flight' : 'no-claim' };
}

module.exports = { handleXteam, handleXteamCreate, handleXteamStatus, leadPrompt, participantPrompt, loadPerspectives };
