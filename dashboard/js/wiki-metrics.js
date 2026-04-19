(function() { // Wiki Metrics — client-side display for wiki usage and health grade

let _wikiMetrics = null;

function _fallbackMetrics() {
  return { totalAccess: 0, sections: {},
    grade: '?', score: 0, gradeReasons: ['Metrics API unavailable'] };
}

async function fetchWikiMetrics() {
  try {
    const r = await fetch('/api/wiki-metrics');
    if (r.ok) _wikiMetrics = await r.json();
    else if (!_wikiMetrics) _wikiMetrics = _fallbackMetrics();
  } catch (e) {
    console.warn('wiki-metrics: fetch failed:', e.message);
    if (!_wikiMetrics) _wikiMetrics = _fallbackMetrics();
  }
  return _wikiMetrics;
}

function trackWikiAccess(section, slug) {
  const u = `/api/wiki-access?section=${encodeURIComponent(section || '')}&slug=${encodeURIComponent(slug || '')}`;
  fetch(u).catch(() => {});
}

function gradeColor(g) {
  return { A: 'healthy', B: 'healthy', C: 'degraded', D: 'degraded', F: 'offline' }[g] || 'unknown';
}

function renderWikiMetrics(m, health) {
  if (!m) return '<div class="wiki-metrics-empty">📊 No metrics available — browse wiki pages to generate usage data.</div>';
  const grade = m.grade || '?';
  const cls = gradeColor(grade);
  const total = m.totalAccess || 0;
  const last = m.lastAccess ? new Date(m.lastAccess).toLocaleString() : 'never';

  // Section popularity bars
  const secs = Object.entries(m.sections || {}).sort((a, b) => b[1] - a[1]);
  const maxHits = secs[0]?.[1] || 1;
  const secBars = secs.map(([s, n]) => {
    const pct = Math.round((n / maxHits) * 100);
    return `<div class="wm-row"><span class="wm-lbl">${esc(s)}</span>
      <div class="wm-bar-wrap"><div class="wm-bar" style="width:${pct}%"></div></div>
      <span class="wm-count">${n}</span></div>`;
  }).join('') || '<div class="wiki-muted">No section views recorded</div>';

  // Grade reasons
  const reasons = (m.gradeReasons || []).map(r => `<li>${esc(r)}</li>`).join('') || '<li>Wiki looks healthy</li>';

  // Issue drilldowns from health data
  const drilldown = health ? renderIssueDrilldowns(health) : '';

  return `<div class="wiki-metrics">
    <div class="wm-grade-row">
      <span class="wm-grade badge ${cls}">${grade}</span>
      <span class="wm-score">${m.score ?? '?'}/100</span>
      <span class="wm-total">📖 ${total} total accesses</span>
      <span class="wm-last wiki-muted">last: ${esc(last)}</span>
    </div>
    <details class="wm-details"><summary>Grade rationale</summary><ul class="wm-reasons">${reasons}</ul></details>
    <div class="wm-section-title">Section popularity</div>
    <div class="wm-bars">${secBars}</div>
    ${drilldown}
  </div>`;
}

function renderIssueDrilldowns(h) {
  const cats = [
    ['🔗 Broken links', h.broken || [], 'Link target does not exist in wiki'],
    ['🏝️ Orphan pages', h.orphans || [], 'No other page links to this page'],
    ['📝 Missing frontmatter', h.frontmatter || [], 'Page does not start with --- YAML front matter'],
    ['📇 Not in index', h.indexSync || [], 'Page not referenced in wiki/index.md'],
  ];
  return cats.filter(([, a]) => a.length).map(([label, items, tip]) =>
    `<details class="wm-issue-group"><summary title="${esc(tip)}">${label} (${items.length}) ℹ️</summary>
    <ul class="wm-issue-list">${items.map(x => `<li><code>${esc(x)}</code></li>`).join('')}</ul>
    </details>`
  ).join('') || '<div class="wm-all-ok">✅ No structural issues</div>';
}
Object.assign(window,{fetchWikiMetrics,trackWikiAccess,gradeColor,renderWikiMetrics,renderIssueDrilldowns});
})();
