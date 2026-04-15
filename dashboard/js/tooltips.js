// Tooltips + Help panel
const TIP_COPY = {
  refresh: ['Refresh', 'Polls all endpoints now.', 'fleet', 'controls'],
  auto: ['Auto refresh', 'Toggle 60s polling.', 'fleet', 'controls'],
  test: ['Stress test', '12 lightweight rounds.', 'fleet', 'controls'],
  tips: ['Tooltips', 'Toggle hover help.', 'help', 'controls'],
  contrast: ['Contrast', 'High-contrast theme.', 'fleet', 'controls'],
  'view-fleet': ['Fleet', 'Topology, baton, activity.', 'fleet', 'fleet'],
  'view-ops': ['Ops', 'Quotas and router.', 'ops', 'quotas'],
  'view-resources': ['Resources', 'Device/service cards.', 'resources', 'data'],
  'view-help': ['Help', 'Full documentation.', 'help', 'views'],
  'view-wiki': ['Wiki', 'Research wiki browser.', 'wiki', 'views'],
  wiki: ['Wiki health', 'Page stats.', 'ops', 'views'],
  'wiki-reader': ['Wiki reader', 'Browse research.', 'wiki', 'views'],
  topology: ['Topology', 'SVG mesh graph.', 'fleet', 'fleet'],
  baton: ['Baton flow', 'Role pipeline.', 'fleet', 'baton'],
  'resource-mon': ['Resources', 'OpenClaw+Tailscale.', 'fleet', 'resources'],
  activity: ['Activity', 'Live event log.', 'fleet', 'activity'],
  devices: ['Devices', 'Fleet inventory.', 'resources', 'data'],
  services: ['Services', 'API services.', 'resources', 'data'],
  quotas: ['Quotas', 'Usage bars.', 'ops', 'quotas'],
  stats: ['Live stats', 'Model snapshots.', 'ops', 'router'],
  router: ['Task lanes', 'Lane distribution.', 'ops', 'router'],
  'router-log': ['Router log', 'LLM choices.', 'ops', 'router'],
  config: ['Settings', 'Preferences.', 'ops', 'controls'],
  'test-panel': ['Stress test', 'Results.', 'ops', 'controls'],
  help: ['Help center', 'Documentation.', 'help', 'views']
};

// renderHelpPanel is in help-content.js — removed from here

function filterHelp(q) {
  filterHelpSections(q);
}

function initTooltips(app) {
  const tip = document.getElementById('app-tip');
  let hideTimer = null;

  window._tipNav = (view, helpId) => {
    app.currentView = 'help';
    app.activeTip = '';
    setTimeout(() => {
      const el = document.getElementById('help-' + helpId);
      if (el) { el.open = true; el.scrollIntoView({ behavior: 'smooth' }); }
    }, 200);
  };

  function showTip(node) {
    if (!app.tooltipsEnabled) return;
    const key = node.dataset.tip;
    const [t, d, view, helpId] = TIP_COPY[key] || ['Info', '', 'fleet', ''];
    app.activeTip = `<strong>${esc(t)}</strong><p>${esc(d)}</p>`
      + `<button class="tip-nav" onclick="_tipNav('${view}','${helpId}')"
          >Help: ${esc(t)} →</button>`;
    const rect = node.getBoundingClientRect(), tw = 220;
    let left = Math.max(4, Math.min(
      rect.left + rect.width / 2 - tw / 2, innerWidth - tw - 4));
    let top = rect.bottom + 2;
    if (top + 80 > innerHeight) top = rect.top - 80;
    Object.assign(tip.style, {
      left: left + 'px', top: top + 'px', right: 'auto', bottom: 'auto'
    });
  }

  document.addEventListener('mouseover', e => {
    if (!app.tooltipsEnabled) return;
    if (e.target.closest('#app-tip')) { clearTimeout(hideTimer); return; }
    const node = e.target.closest('[data-tip]');
    if (node) { clearTimeout(hideTimer); showTip(node); }
  });
  document.addEventListener('mouseout', e => {
    const leaving = e.target.closest('[data-tip]');
    if (!leaving) return;
    if (e.relatedTarget?.closest('#app-tip')) return;
    hideTimer = setTimeout(() => { app.activeTip = ''; }, 500);
  });
  tip?.addEventListener('mouseleave', () => {
    hideTimer = setTimeout(() => { app.activeTip = ''; }, 400);
  });
}

function clearTooltip(app) { app.activeTip = ''; }
function toggleHelpMode() {
  const el = document.querySelector('[x-data]');
  const d = Alpine.$data(el);
  d.helpDevMode = !d.helpDevMode;
}
