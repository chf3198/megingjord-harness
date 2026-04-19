#!/usr/bin/env node
// GitHub API module — uses gh CLI for authenticated access
const { execSync } = require('child_process');
const REPO = 'chf3198/devenv-ops';
const GH = 'gh api --cache 60s';

function ghApi(endpoint, jq) {
  try {
    const cmd = jq
      ? `${GH} "${endpoint}" --jq '${jq}'`
      : `${GH} "${endpoint}"`;
    return JSON.parse(execSync(cmd, { timeout: 10000 }).toString());
  } catch { return null; }
}

function getRepoInfo() {
  return ghApi(`repos/${REPO}`,
    '{stars:.stargazers_count,forks:.forks_count,open_issues:.open_issues_count,default_branch:.default_branch}');
}

function getIssues() {
  return ghApi(`repos/${REPO}/issues?state=all&per_page=30&sort=updated`,
    '[.[]|{number,title,state,labels:[.labels[]|.name],assignee:.assignee.login,body:(.body[:120]),created:.created_at,updated:.updated_at,isPR:(.pull_request!=null)}]');
}
function getIssueComments(num) {
  return ghApi(`repos/${REPO}/issues/${num}/comments?per_page=1&sort=updated&direction=desc`,
    '[.[]|{body:(.body[:100]),user:.user.login,updated:.updated_at}]');
}

function getPulls() {
  return ghApi(`repos/${REPO}/pulls?state=all&per_page=10&sort=updated`,
    '[.[]|{number,title,state,merged:(.merged_at!=null),branch:.head.ref,created:.created_at,updated:.updated_at}]');
}

function getWorkflowRuns() {
  return ghApi(`repos/${REPO}/actions/runs?per_page=10`,
    '[.workflow_runs[]|{id,name,status,conclusion,branch:.head_branch,event,created:.created_at}]');
}

function getBranches() {
  return ghApi(`repos/${REPO}/branches?per_page=30`,
    '[.[]|{name,protected}]');
}

function getSummary() {
  const repo = getRepoInfo();
  const issues = getIssues() || [];
  const pulls = getPulls() || [];
  const runs = getWorkflowRuns() || [];
  const branches = getBranches() || [];
  const realIssues = issues.filter(i => !i.isPR);
  // Enrich recent issues with last comment (for DUX4 ticket log)
  const enriched = realIssues.slice(0, 20).map(i => {
    const c = getIssueComments(i.number);
    const last = c && c[0] ? c[0].body : null;
    const epic = i.body?.match(/Parent:\s*#(\d+)/)?.[1] || null;
    return { ...i, lastComment: last, epic: epic ? Number(epic) : null };
  });
  return {
    repo: repo || {},
    issues: {
      open: realIssues.filter(i => i.state === 'open').length,
      closed: realIssues.filter(i => i.state === 'closed').length,
      recent: enriched.slice(0, 8),
      all: enriched
    },
    pulls: {
      open: pulls.filter(p => p.state === 'open').length,
      merged: pulls.filter(p => p.merged).length,
      recent: pulls.slice(0, 6)
    },
    actions: { recent: runs.slice(0, 6) },
    branches: {
      count: branches.length,
      active: branches.slice(0, 10).map(b => b.name)
    },
    timestamp: new Date().toISOString()
  };
}

module.exports = { getSummary, getRepoInfo, getIssues, getPulls, getIssueComments };
