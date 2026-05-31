// gh-client.js — thin wrapper around `gh` CLI for testability + dependency injection
'use strict';

const { execFileSync } = require('node:child_process');

function shell(args) {
  return execFileSync('gh', args, { encoding: 'utf8', timeout: 10000 });
}

async function viewLabels(ticket) {
  const out = shell(['issue', 'view', String(ticket), '--json', 'labels']);
  return JSON.parse(out).labels || [];
}

async function addLabel(ticket, label) {
  shell(['issue', 'edit', String(ticket), '--add-label', label]);
}

async function removeLabel(ticket, label) {
  shell(['issue', 'edit', String(ticket), '--remove-label', label]);
}

async function createEpic({ title, body, labels }) {
  const labelArgs = (labels || []).flatMap(l => ['--label', l]);
  const out = shell(['issue', 'create', '--title', title, '--body', body, ...labelArgs]);
  const url = out.trim().split('\n').pop();
  const match = url.match(/\/(\d+)$/);
  if (!match) throw new Error(`could not parse created Epic URL: ${url}`);
  return { number: parseInt(match[1], 10), url };
}

module.exports = { viewLabels, addLabel, removeLabel, createEpic };
