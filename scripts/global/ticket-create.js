#!/usr/bin/env node
'use strict';
const { execSync } = require('child_process');
const readline = require('readline');
const { checkCreation, logBypass } = require('./phase-gate');

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

function prompt(question) {
  return new Promise(resolve => rl.question(question, resolve));
}

async function createTicket() {
  const force = process.argv.includes('--force');
  console.log('\n📋 Ticket Creation Wizard\n');

  const title = await prompt('Title: ');
  const desc = await prompt('Description (short): ');
  const type = await prompt('Type (epic|story|task|bug|doc): ');
  const points = await prompt('Story Points (or skip): ');
  const parentEpic = await prompt('Parent Epic # (or skip): ');
  const dependsOn = await prompt('Depends On issue #s comma-separated (or skip): ');

  const labels = [`scrum:${type}`, 'status:backlog'];
  let body = desc;
  if (points) body += `\n\n**Story Points**: ${points}`;
  if (parentEpic) body += `\n\n## Parent Epic\n#${parentEpic.replace(/[^0-9]/g, '')}`;
  if (dependsOn) body += `\n\n## Depends On\n${dependsOn.split(',').map(item => `#${item.replace(/[^0-9]/g, '')}`).join(', ')}`;

  const failures = checkCreation(Number(parentEpic.replace(/[^0-9]/g, '') || 0));
  if (failures.length && !force) {
    failures.forEach(item => console.error(`❌ ${item}`));
    rl.close();
    process.exit(1);
  }
  if (failures.length && force) logBypass({ action: 'ticket-create', parentEpic: Number(parentEpic || 0) }, failures);

  try {
    const cmd = [
      'gh', 'issue', 'create',
      '--title', title,
      '--body', body,
      '--label', labels.join(',')
    ];
    const out = execSync(cmd.join(' '), { encoding: 'utf8' }).trim();
    const match = out.match(/#(\d+)/);
    const issueNum = match ? match[1] : 'N/A';
    console.log(`\n✅ Created ticket #${issueNum}`);
    console.log(`\n📌 Use branch: #${issueNum}-<slug>`);
    console.log(`\n💡 Reference in commits: closes #${issueNum}`);
    rl.close();
  } catch (e) {
    console.error('Error creating ticket:', e.message);
    rl.close();
    process.exit(1);
  }
}

createTicket();
