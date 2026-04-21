(function() { /* GitHub Monitor — dashboard panel for repo activity */
/* globals: called from app.js, data from /api/github/summary */

let _ghCache = null;
let _ghLoading = false;

async function pollGitHub() {
  if (_ghLoading) return _ghCache;
  _ghLoading = true;
  try {
    const controller = new AbortController();
    const to = setTimeout(() => controller.abort(), 6000);
    const r = await fetch('/api/github/summary', { signal: controller.signal });
    clearTimeout(to);
    if (!r.ok) {
      const body = await r.json().catch(()=>({}));
      _ghCache = { error: body.error || 'github_error', message: body.message || `status:${r.status}` };
    } else {
      _ghCache = await r.json();
    }
  } catch (e) {
    console.warn('github-monitor: fetch failed:', e && e.message ? e.message : e);
    _ghCache = { error: 'fetch_failed', message: String(e && e.message ? e.message : e) };
  }
  _ghLoading = false;
  return _ghCache;
}

function ghIcon(conclusion) {
  const map = { success: '✅', failure: '❌', cancelled: '⚫',
    skipped: '⏭️', in_progress: '🔄', queued: '⏳' };
  return map[conclusion] || '⬜';
}

function renderGitHubMonitor(gh) {
  if (!gh) return `<div class="gh-empty">
    <span style="font-size:1.5rem">🔄</span>
    <p>Connecting to GitHub API…</p>
    <p style="font-size:0.72rem;color:var(--text-muted)">Data loads on first refresh cycle</p></div>`;
  if (gh && gh.error) return `<div class="gh-error">
    <span style="font-size:1.5rem">⚠️</span>
    <p>GitHub data unavailable</p>
    <p style="font-size:0.72rem;color:var(--text-muted)">${esc(gh.message || gh.error)}</p>
    <button class="gh-retry">Retry</button>
  </div>`;
  const { issues, pulls, actions, branches } = gh;
  const statsHtml = `<div class="gh-stats">
    <div class="gh-stat"><span class="gh-num">${issues.open}</span><span class="gh-lbl">Open Issues</span></div>
    <div class="gh-stat"><span class="gh-num">${pulls.open}</span><span class="gh-lbl">Open PRs</span></div>
    <div class="gh-stat"><span class="gh-num">${pulls.merged}</span><span class="gh-lbl">Merged PRs</span></div>
    <div class="gh-stat"><span class="gh-num">${branches.count}</span><span class="gh-lbl">Branches</span></div>
  </div>`;
  const issueRows = (issues.recent || []).slice(0, 5).map(i =>
    `<tr><td>#${i.number}</td><td>${esc(i.title).substring(0, 40)}</td>` +
    `<td><span class="gh-badge gh-${esc(i.state)}">${esc(i.state)}</span></td></tr>`
  ).join('');
  const runRows = (actions.recent || []).slice(0, 4).map(r =>
    `<tr><td>${ghIcon(r.conclusion || r.status)}</td><td>${esc(r.name)}</td>` +
    `<td>${esc(r.branch || '')}</td><td>${esc(r.conclusion || r.status)}</td></tr>`
  ).join('');
  const prRows = (pulls.recent || []).slice(0, 4).map(p =>
    `<tr><td>#${p.number}</td><td>${esc(p.title).substring(0, 35)}</td>` +
    `<td><span class="gh-badge gh-${p.merged ? 'merged' : esc(p.state)}">${p.merged ? 'merged' : esc(p.state)}</span></td></tr>`
  ).join('');
  const branchList = (branches.active || []).slice(0, 6).map(b =>
    `<span class="gh-branch">${esc(b)}</span>`).join(' ');
  return `${statsHtml}
    <div class="gh-tables">
      <div><h4>Recent Issues</h4><table class="gh-tbl">${issueRows || '<tr><td colspan=3>None</td></tr>'}</table></div>
      <div><h4>Recent PRs</h4><table class="gh-tbl">${prRows || '<tr><td colspan=3>None</td></tr>'}</table></div>
      <div><h4>Actions</h4><table class="gh-tbl">${runRows || '<tr><td colspan=4>None</td></tr>'}</table></div>
    </div>
    <div class="gh-branches"><h4>Active Branches</h4>${branchList || 'None'}</div>`;
}
if(typeof module!=="undefined")module.exports={pollGitHub,ghIcon,renderGitHubMonitor};else Object.assign(window,{pollGitHub,ghIcon,renderGitHubMonitor});
})();
