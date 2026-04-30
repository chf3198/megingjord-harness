#!/usr/bin/env node
'use strict';

const GH_API_VERSION = '2022-11-28';

const GH_HEADERS = token => ({
  Authorization: `Bearer ${token}`,
  Accept: 'application/vnd.github+json',
  'X-GitHub-Api-Version': GH_API_VERSION,
});

async function get(url, token) {
  const res = await fetch(url, { headers: GH_HEADERS(token) });
  if (!res.ok) throw new Error(`GitHub API ${res.status} on ${url}`);
  return res.json();
}

async function getOpenEpics(token, owner, repo) {
  const epics = [];
  let page = 1;
  while (true) {
    const batch = await get(
      `https://api.github.com/repos/${owner}/${repo}/issues?labels=type:epic&state=open&per_page=100&page=${page}`,
      token
    );
    if (!batch.length) break;
    epics.push(...batch);
    if (batch.length < 100) break;
    page++;
  }
  return epics;
}

async function getOpenChildCount(token, owner, repo, epicNum) {
  const timeline = await get(
    `https://api.github.com/repos/${owner}/${repo}/issues/${epicNum}/timeline?per_page=100`,
    token
  );
  const childNums = [...new Set(
    timeline
      .filter(e => e.event === 'cross-referenced' && e.source?.issue?.number)
      .map(e => e.source.issue.number)
  )];
  const openChildren = await Promise.all(
    childNums.map(n =>
      get(`https://api.github.com/repos/${owner}/${repo}/issues/${n}`, token)
        .then(i => (i.state === 'open' ? n : null))
        .catch(() => null)
    )
  );
  return openChildren.filter(Boolean).length;
}

async function hasCloseout(token, owner, repo, issueNum) {
  const comments = await get(
    `https://api.github.com/repos/${owner}/${repo}/issues/${issueNum}/comments?per_page=100`,
    token
  );
  return comments.some(c => c.body?.includes('CONSULTANT_CLOSEOUT'));
}

async function validateEpics(token, owner, repo) {
  const epics = await getOpenEpics(token, owner, repo);
  const results = [];
  for (const epic of epics) {
    const statusLabels = epic.labels.map(l => l.name).filter(l => l.startsWith('status:'));
    const blockers = [];
    if (!statusLabels.includes('status:review')) {
      blockers.push(`not at status:review (current: ${statusLabels.join(', ') || 'none'})`);
    }
    const openChildCount = await getOpenChildCount(token, owner, repo, epic.number);
    if (openChildCount > 0) blockers.push(`${openChildCount} open child issue(s) remain`);
    const closeout = await hasCloseout(token, owner, repo, epic.number);
    if (!closeout) blockers.push('missing CONSULTANT_CLOSEOUT comment');
    results.push({ epicNum: epic.number, title: epic.title, ready: blockers.length === 0, blockers });
  }
  return results;
}

module.exports = { validateEpics };

if (require.main === module) {
  const token = process.env.GITHUB_TOKEN;
  const [owner, repo] = (process.env.GITHUB_REPOSITORY || 'chf3198/megingjord-harness').split('/');
  validateEpics(token, owner, repo)
    .then(r => console.log(JSON.stringify(r, null, 2)))
    .catch(e => { console.error(e.message); process.exit(1); });
}
