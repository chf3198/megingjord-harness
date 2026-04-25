#!/usr/bin/env node
'use strict';
const { execFileSync } = require('child_process');

const TRANSITIONS = {
  backlog: ['ready', 'in-progress'],
  triage: ['ready'],
  ready: ['in-progress'],
  'in-progress': ['testing'],
  testing: ['review'],
  review: ['done'],
};
const ROLE_FOR = {
  'in-progress': 'collaborator',
  testing: 'admin',
  review: 'consultant',
};

const [,, issue, fromStatus, toStatus, ...extras] = process.argv;
const force = extras.includes('--force');
const dryRun = extras.includes('--dry-run');
if (!issue || !fromStatus || !toStatus) {
  console.error('Usage: issue-transition.js <issue#> <from-status> <to-status> [--force] [--dry-run]');
  process.exit(1);
}

const allowed = TRANSITIONS[fromStatus] || [];
if (!allowed.includes(toStatus) && !force) {
  console.error(`Invalid transition: ${fromStatus} → ${toStatus}`);
  console.error(`Allowed from ${fromStatus}: ${allowed.join(', ') || 'none'}`);
  process.exit(1);
}

function gh(args, input) {
  return execFileSync('gh', args, {
    encoding: 'utf8',
    input: input ? JSON.stringify(input) : undefined,
  }).trim();
}

const repo = gh(['repo', 'view', '--json', 'nameWithOwner', '-q', '.nameWithOwner']);
const data = JSON.parse(gh(['api', `repos/${repo}/issues/${issue}`]));
const labels = data.labels.map(label => label.name);
const current = labels.filter(label => label.startsWith('status:')).map(label => label.slice(7));
if (!force && !current.includes(fromStatus)) {
  console.error(`Issue #${issue} is not currently at status:${fromStatus}`);
  console.error(`Current status labels: ${current.join(', ') || 'none'}`);
  process.exit(1);
}

const next = labels.filter(label => !label.startsWith('status:') && !label.startsWith('role:'));
next.push(`status:${toStatus}`);
if (ROLE_FOR[toStatus]) next.push(`role:${ROLE_FOR[toStatus]}`);

if (dryRun) {
  console.log(JSON.stringify({ issue: Number(issue), repo, labels: next }, null, 2));
  process.exit(0);
}

gh(['api', `repos/${repo}/issues/${issue}/labels`, '-X', 'PUT', '--input', '-'], { labels: next });
if (toStatus === 'in-progress') {
  const { classifyPrompt } = require('./task-router');
  const route = classifyPrompt(data.title);
  console.log(`task-route: lane=${route.lane} model=${route.recommendedModel} (confidence: ${route.confidence})`);
}
console.log(`#${issue}: ${fromStatus}(${ROLE_FOR[fromStatus] || '-'}) → ${toStatus}(${ROLE_FOR[toStatus] || '-'})`);
