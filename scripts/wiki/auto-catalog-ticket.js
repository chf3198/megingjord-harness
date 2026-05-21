'use strict';
const cp = require('child_process');
const fs = require('fs');
const path = require('path');

function gh(args) {
  return cp.execFileSync('gh', args, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
}

function parseCloseoutScore(comments) {
  const closeout = comments.slice().reverse().find(c => c.body?.includes('CONSULTANT_CLOSEOUT'));
  if (!closeout) return null;
  const match = closeout.body.match(/Rubric Rating:\s*(\d+)/i) || closeout.body.match(/score:\s*(\d+)/i) || closeout.body.match(/(\d+)\/10/);
  return match ? Number(match[1]) : null;
}

function autoCatalogTicket(issueNum) {
  const issue = JSON.parse(gh(['issue', 'view', String(issueNum), '--json', 'title,body,state,comments']));
  if (issue.state !== 'CLOSED' && issue.state !== 'done') {
    throw new Error(`Issue #${issueNum} is not closed (current state: ${issue.state})`);
  }

  const score = parseCloseoutScore(issue.comments || []);
  if (score === null || score < 8) {
    throw new Error(`Issue #${issueNum} closeout rubric score (${score ?? 'N/A'}) is below the required threshold of 8`);
  }

  let prBody = 'No merged PR found.';
  try {
    const prs = JSON.parse(gh(['pr', 'list', '--state', 'merged', '--search', `Closes #${issueNum}`, '--json', 'number,title,body']));
    if (prs.length) prBody = `PR #${prs[0].number}: ${prs[0].title}\n\n${prs[0].body || ''}`;
  } catch {}

  const date = new Date().toISOString().split('T')[0];
  const content = `---
title: "Resolved: Issue #${issueNum} - ${issue.title}"
type: source
created: ${date}
updated: ${date}
tags: [resolved-issue, megingjord-harness]
sources: [issues/${issueNum}]
related: []
status: mature
---

# Ingested Ticket Audit

## Objectives
${issue.body || 'No description provided.'}

## Resolution Summary
${prBody}

## Verification Rubric Score
Verified with closeout rubric score: **${score}/10**
`;

  const destDir = path.join(__dirname, '..', '..', 'raw', 'articles');
  fs.mkdirSync(destDir, { recursive: true });
  const file = path.join(destDir, `issue-${issueNum}.md`);
  fs.writeFileSync(file, content, 'utf8');

  // Trigger wiki ingestion
  const root = path.join(__dirname, '..', '..');
  cp.execFileSync('npm', ['run', 'wiki:ingest', '--', `raw/articles/issue-${issueNum}.md`], { cwd: root, stdio: 'inherit' });
  return file;
}

if (require.main === module) {
  const args = process.argv.slice(2);
  const idx = args.indexOf('--issue');
  if (idx === -1 || !args[idx + 1]) {
    console.error('Usage: node auto-catalog-ticket.js --issue <number>');
    process.exit(1);
  }
  try {
    const file = autoCatalogTicket(args[idx + 1]);
    console.log(`✅ Automatically cataloged ticket to: ${file}`);
  } catch (err) {
    console.error(`❌ Cataloging failed: ${err.message}`);
    process.exit(1);
  }
}

module.exports = { autoCatalogTicket, parseCloseoutScore };
