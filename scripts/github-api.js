#!/usr/bin/env node
// GitHub API module — async exec with background cache (never blocks event loop)
const { exec } = require('child_process');
const REPO = 'chf3198/devenv-ops';
const GH = 'gh api --cache 60s';
let _cache = null; let _refreshing = false; let _lastFetch = 0;
const CACHE_TTL = 90000; // 90s

function ghApiAsync(endpoint, jq) {
  const cmd = jq ? `${GH} "${endpoint}" --jq '${jq}'` : `${GH} "${endpoint}"`;
  return new Promise(resolve => {
    exec(cmd, { timeout: 8000 }, (err, stdout) => {
      if (err) return resolve(null);
      try { resolve(JSON.parse(stdout)); } catch { resolve(null); }
    });
  });
}

async function fetchSummary() {
  const [repo, issues, pulls, runs, branches] = await Promise.all([
    ghApiAsync(`repos/${REPO}`,
      '{stars:.stargazers_count,forks:.forks_count,open_issues:.open_issues_count,default_branch:.default_branch}'),
    ghApiAsync(`repos/${REPO}/issues?state=all&per_page=30&sort=updated`,
      '[.[]|{number,title,state,labels:[.labels[]|.name],assignee:.assignee.login,body:(.body[:120]),created:.created_at,updated:.updated_at,isPR:(.pull_request!=null)}]'),
    ghApiAsync(`repos/${REPO}/pulls?state=all&per_page=10&sort=updated`,
      '[.[]|{number,title,state,merged:(.merged_at!=null),branch:.head.ref,created:.created_at,updated:.updated_at}]'),
    ghApiAsync(`repos/${REPO}/actions/runs?per_page=10`,
      '[.workflow_runs[]|{id,name,status,conclusion,branch:.head_branch,event,created:.created_at}]'),
    ghApiAsync(`repos/${REPO}/branches?per_page=30`, '[.[]|{name,protected}]'),
  ]);
  const realIssues = (issues || []).filter(i => !i.isPR);
  const toEnrich = realIssues.slice(0, 10);
  const comments = await Promise.all(toEnrich.map(i =>
    ghApiAsync(`repos/${REPO}/issues/${i.number}/comments?per_page=1&sort=updated&direction=desc`,
      '[.[]|{body:(.body[:100]),user:.user.login,updated:.updated_at}]')
  ));
  const enriched = toEnrich.map((i, idx) => {
    const c = comments[idx]; const last = c && c[0] ? c[0].body : null;
    const epic = i.body?.match(/Parent:\s*#(\d+)/)?.[1] || null;
    return { ...i, lastComment: last, epic: epic ? Number(epic) : null };
  });
  const allPulls = pulls || [];
  return {
    repo: repo || {},
    issues: {
      open: realIssues.filter(i => i.state === 'open').length,
      closed: realIssues.filter(i => i.state === 'closed').length,
      recent: enriched.slice(0, 8), all: enriched
    },
    pulls: {
      open: allPulls.filter(p => p.state === 'open').length,
      merged: allPulls.filter(p => p.merged).length, recent: allPulls.slice(0, 6)
    },
    actions: { recent: (runs || []).slice(0, 6) },
    branches: { count: (branches||[]).length, active: (branches||[]).slice(0,10).map(b=>b.name) },
    timestamp: new Date().toISOString()
  };
}

function refreshInBackground() {
  if (_refreshing) return;
  _refreshing = true;
  fetchSummary().then(data => {
    _cache = data; _lastFetch = Date.now(); _refreshing = false;
  }).catch(() => { _refreshing = false; });
}

async function getSummary() {
  if (_cache && (Date.now() - _lastFetch) < CACHE_TTL) return _cache;
  refreshInBackground();
  return _cache || { repo:{}, issues:{open:0,closed:0,recent:[],all:[]},
    pulls:{open:0,merged:0,recent:[]}, actions:{recent:[]},
    branches:{count:0,active:[]}, timestamp:new Date().toISOString() };
}

module.exports = { getSummary, getRepoInfo: () => ghApiAsync(`repos/${REPO}`),
  getIssues: () => ghApiAsync(`repos/${REPO}/issues?state=all&per_page=30&sort=updated`) };
