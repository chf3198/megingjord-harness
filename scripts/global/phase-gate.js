#!/usr/bin/env node
'use strict';
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const parentRx = /##\s+Parent Epic\s*\n#(\d+)/i;
const depRx = /##\s+Depends On\s*\n((?:#\d+(?:[^\n]*)\n?)*)/i;
const refRx = /#(\d+)/g;
const actor = () => process.env.GITHUB_ACTOR || process.env.USER || 'unknown';
const auditFile = () => path.join(process.env.HOME || '.', '.megingjord', 'phase-gate-bypass.jsonl');
const ghJson = args => JSON.parse(execFileSync('gh', args, { encoding: 'utf8', maxBuffer: 16 * 1024 * 1024 }).trim());
const refs = text => [...String(text || '').matchAll(refRx)].map(match => Number(match[1]));
const parseBody = body => ({
  parentEpic: Number(String(body || '').match(parentRx)?.[1] || 0),
  dependsOn: refs(String(body || '').match(depRx)?.[1] || ''),
});
const done = issue => issue.state === 'CLOSED' || (issue.labels || []).some(label => label.name === 'status:done');

function listChildren(epic, gh = ghJson) {
  return gh(['issue', 'list', '--state', 'all', '--limit', '500', '--json', 'number,title,body,state,labels'])
    .filter(item => parseBody(item.body).parentEpic === Number(epic));
}

function checkCreation(parentEpic, gh = ghJson) {
  if (!parentEpic) return [];
  const rd = listChildren(parentEpic, gh).find(item => /phase-0 r&d/i.test(item.title) || new RegExp(`^D-${parentEpic}-01:`).test(item.title));
  if (!rd) return [`epic #${parentEpic}: missing Phase-0 R&D child ticket`];
  return done(rd) ? [] : [`epic #${parentEpic}: Phase-0 R&D gate not complete (#${rd.number})`];
}

function checkTransition(issue, gh = ghJson) {
  const failures = [];
  const meta = parseBody(issue.body);
  failures.push(...checkCreation(meta.parentEpic, gh));
  meta.dependsOn.forEach(number => {
    const dep = gh(['issue', 'view', String(number), '--json', 'number,state,labels']);
    if (!done(dep)) failures.push(`issue #${issue.number}: dependency #${number} not complete`);
  });
  return failures;
}

function logBypass(context, failures) {
  const file = auditFile();
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.appendFileSync(file, `${JSON.stringify({ ts: new Date().toISOString(), actor: actor(), context, failures })}\n`);
}

module.exports = { parseBody, checkCreation, checkTransition, logBypass, listChildren };