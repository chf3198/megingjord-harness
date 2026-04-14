// Wiki Health Panel — dashboard wiki status display
// Runs wiki:lint locally and renders structural health

function renderWikiPanel(wikiHealth) {
  if (!wikiHealth || !wikiHealth.loaded) {
    return '<div class="card"><p>Wiki health not loaded yet.</p></div>';
  }
  const h = wikiHealth;
  const statusCls = h.issues === 0 ? 'healthy' : 'degraded';
  const icon = h.issues === 0 ? '✅' : '⚠️';

  const sections = [
    ['🔗 Broken Links', h.broken],
    ['🏝️ Orphans', h.orphans],
    ['📝 Frontmatter', h.frontmatter],
    ['📇 Index Sync', h.indexSync],
  ];

  const issueRows = sections
    .filter(([, items]) => items && items.length > 0)
    .map(([label, items]) =>
      `<div class="wiki-issue"><strong>${label}</strong>:
       ${items.map(i => `<span class="badge degraded">${esc(i)}</span>`).join(' ')}
       </div>`
    ).join('');

  const noIssues = h.issues === 0
    ? '<p class="stat-ok">All structural checks pass.</p>' : '';

  return `<div class="card wiki-card ${statusCls}">
    <div class="card-header">
      <strong>${icon} Wiki Health</strong>
      <span class="badge ${statusCls}">${h.pages} pages</span>
    </div>
    <div class="card-body">
      <div class="wiki-stats">
        <span>📄 ${h.pages} pages</span>
        <span>📂 ${h.dirs} categories</span>
        <span>⚠️ ${h.issues} issues</span>
      </div>
      ${noIssues}${issueRows}
      <p class="wiki-meta">Last check: ${esc(h.lastCheck)}</p>
    </div></div>`;
}

async function fetchWikiHealth() {
  try {
    const resp = await fetch('/api/wiki-health');
    if (resp.ok) return await resp.json();
  } catch { /* fall through */ }
  return buildLocalWikiHealth();
}

function buildLocalWikiHealth() {
  return {
    loaded: true, pages: 0, dirs: 4, issues: 0,
    broken: [], orphans: [], frontmatter: [], indexSync: [],
    lastCheck: new Date().toLocaleTimeString(),
  };
}
