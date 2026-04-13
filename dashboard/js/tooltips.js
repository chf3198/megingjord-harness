// Tooltips + Help panel — pure Alpine reactive state

const TIP_COPY = {
  refresh: ['Refresh', 'Polls all endpoints immediately.', 'ops', 'panel-router'],
  auto: ['Auto refresh', 'Pauses or resumes polling.', 'ops', 'panel-config'],
  test: ['Stress test', 'Runs 12 lightweight endpoint rounds.', 'ops', 'panel-test'],
  tips: ['Tooltips', 'Toggle contextual UX help.', 'help', 'panel-help'],
  contrast: ['Contrast', 'Switches high-contrast theme.', 'ops', 'panel-config'],
  'view-fleet': ['Fleet', 'Topology, baton, activity, resources.', 'fleet', 'panel-topology'],
  'view-ops': ['Ops', 'Health, quotas, and router.', 'ops', 'panel-router'],
  'view-resources': ['Resources', 'Devices and services inventory.', 'resources', 'panel-devices'],
  'view-help': ['Help', 'Guidance and external links.', 'help', 'panel-help'],
  topology: ['Topology', 'SVG network graph of Tailscale mesh.', 'fleet', 'panel-topology'],
  baton: ['Baton flow', 'Manager→Collaborator→Admin→Consultant.', 'fleet', 'panel-baton'],
  'resource-mon': ['Resources', 'OpenClaw, Tailscale, Ollama.', 'fleet', 'panel-resources'],
  activity: ['Activity', 'Real-time role transitions and events.', 'fleet', 'panel-activity'],
  devices: ['Devices', 'Tailscale + Ollama/OpenClaw cards.', 'resources', 'panel-devices'],
  services: ['Services', 'Paid, free-tier, self-hosted.', 'resources', 'panel-services'],
  quotas: ['Quotas', 'Live and static usage bars.', 'ops', 'panel-quotas'],
  stats: ['Live stats', 'Running model snapshots.', 'ops', 'panel-stats'],
  router: ['Task lanes', 'Free/Fleet/Premium lane mix.', 'ops', 'panel-router'],
  'router-log': ['Router log', 'Recent LLM agent choices.', 'ops', 'panel-router-log'],
  config: ['Settings', 'Refresh, contrast, tooltip prefs.', 'ops', 'panel-config'],
  'test-panel': ['Stress test', 'Per-round pass/fail summary.', 'ops', 'panel-test'],
  help: ['Help center', 'Operational guidance.', 'help', 'panel-help']
};

function renderHelpPanel() {
  return `<div class="config-grid">
  <p><strong>Target viewport:</strong> 960×1080 (half-screen)</p>
  <p><strong>Views:</strong> Fleet (topology + baton + activity +
    resources), Ops (quotas + router), Resources, Help.</p>
  <p><a href="https://developer.chrome.com/docs/lighthouse/overview"
    target="_blank" rel="noopener">Lighthouse docs</a></p>
  <p><a href="https://developer.chrome.com/docs/devtools/memory-problems"
    target="_blank" rel="noopener">DevTools memory guide</a></p></div>`;
}

function initTooltips(app) {
  const tip = document.getElementById('app-tip');
  let hideTimer = null;

  window._tipNav = (view, panelId) => {
    app.currentView = view;
    app.activeTip = '';
    setTimeout(() => {
      document.getElementById(panelId)
        ?.scrollIntoView({ behavior: 'smooth' });
    }, 150);
  };

  function showTip(node) {
    if (!app.tooltipsEnabled) return;
    const key = node.dataset.tip;
    const [t, d, view, panel] = TIP_COPY[key]
      || ['Info', 'No detail', 'fleet', ''];
    app.activeTip = `<strong>${esc(t)}</strong><p>${esc(d)}</p>`
      + `<button class="tip-nav"
          onclick="_tipNav('${view}','${panel}')"
          >Go to ${esc(t)} →</button>`;
    const rect = node.getBoundingClientRect();
    const tw = 260;
    let left = rect.left + rect.width / 2 - tw / 2;
    left = Math.max(8, Math.min(left, window.innerWidth - tw - 8));
    let top = rect.bottom + 6;
    if (top + 100 > window.innerHeight) top = rect.top - 106;
    tip.style.left = left + 'px';
    tip.style.top = top + 'px';
    tip.style.right = 'auto';
    tip.style.bottom = 'auto';
  }

  document.addEventListener('mouseover', e => {
    if (!app.tooltipsEnabled) return;
    if (e.target.closest('#app-tip')) {
      clearTimeout(hideTimer); return;
    }
    const node = e.target.closest('[data-tip]');
    if (!node) return;
    clearTimeout(hideTimer);
    showTip(node);
  });

  document.addEventListener('mouseout', e => {
    const leaving = e.target.closest('[data-tip]');
    const entering = e.relatedTarget;
    if (!leaving) return;
    if (entering && entering.closest('#app-tip')) return;
    hideTimer = setTimeout(() => { app.activeTip = ''; }, 200);
  });

  tip?.addEventListener('mouseleave', () => {
    hideTimer = setTimeout(() => { app.activeTip = ''; }, 150);
  });
}

function clearTooltip(app) { app.activeTip = ''; }
