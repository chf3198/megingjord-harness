#!/usr/bin/env node
'use strict';
// Atomic baton label transition — single gh issue edit to prevent ADR-010 race.
const { execSync } = require('child_process');

const TRANSITIONS = {
  triage:      ['ready'],
  ready:       ['in-progress'],
  'in-progress':['testing'],
  testing:     ['review'],
  review:      ['done'],
};
const ROLE_FOR = {
  triage: 'manager', 'in-progress': 'collaborator',
  testing: 'admin', review: 'consultant',
};

const [,, issue, fromStatus, toStatus, extra] = process.argv;
if (!issue || !fromStatus || !toStatus) {
  console.error('Usage: issue-transition.js <issue#> <from-status> <to-status> [--force]');
  process.exit(1);
}

const allowed = TRANSITIONS[fromStatus];
if (!allowed?.includes(toStatus) && extra !== '--force') {
  console.error(`Invalid transition: ${fromStatus} → ${toStatus}`);
  console.error(`Allowed from ${fromStatus}: ${allowed?.join(', ') || 'none'}`);
  process.exit(1);
}

const adds = [`status:${toStatus}`];
const removes = [`status:${fromStatus}`];

const fromRole = ROLE_FOR[fromStatus];
const toRole = ROLE_FOR[toStatus];
if (fromRole) removes.push(`role:${fromRole}`);
if (toRole) adds.push(`role:${toRole}`);

const addFlags = adds.map(l => `--add-label "${l}"`).join(' ');
const removeFlags = removes.map(l => `--remove-label "${l}"`).join(' ');
const cmd = `gh issue edit ${issue} ${addFlags} ${removeFlags}`;

try {
  execSync(cmd, { stdio: 'inherit' });
  console.log(`#${issue}: ${fromStatus}(${fromRole||'-'}) → ${toStatus}(${toRole||'-'})`);
} catch (e) {
  console.error('Transition failed:', e.message);
  process.exit(1);
}
