// Tooltips + Help panel — pure Alpine reactive state

const TIP_COPY = {
  refresh: ['Manual refresh', 'Polls all endpoints immediately.', '#panel-router'],
  auto: ['Auto refresh', 'Pauses or resumes polling.', '#panel-config'],
  test: ['Quick stress test', 'Runs 12 lightweight endpoint rounds.', '#panel-test'],
  tips: ['Tooltip mode', 'Toggle contextual UX help.', '#panel-help'],
  contrast: ['Contrast mode', 'Switches high-contrast theme.', '#panel-config'],
  'view-fleet': ['Fleet view', 'Topology, baton flow, and remote resources.', '#panel-topology'],
  'view-ops': ['Ops view', 'Runtime health, quotas, and router.', '#panel-router'],
  'view-resources': ['Resources view', 'Devices and services inventory.', '#panel-devices'],
  'view-help': ['Help view', 'Detailed guidance and links.', '#panel-help'],
  topology: ['Fleet topology', 'SVG network graph of Tailscale mesh.', '#panel-topology'],
  baton: ['Agent baton', 'Manager→Collaborator→Admin→Consultant flow.', '#panel-baton'],
  'resource-mon': ['Remote resources', 'OpenClaw, Tailscale, and Ollama status.', '#panel-resources'],
  devices: ['Fleet devices', 'Tailscale + Ollama/OpenClaw status cards.', '#panel-devices'],
  services: ['Service inventory', 'Paid, free-tier, and self-hosted services.', '#panel-services'],
  quotas: ['Quota tracking', 'Live and static usage bars.', '#panel-quotas'],
  stats: ['Live stats', 'Running model/process snapshots.', '#panel-stats'],
  router: ['Task lanes', 'Free/Fleet/Premium lane mix.', '#panel-router'],
  'router-log': ['Router log', 'Recent LLM agent/model choices.', '#panel-router-log'],
  config: ['Settings', 'Refresh, contrast, and tooltip prefs.', '#panel-config'],
  'test-panel': ['Stress test output', 'Per-round pass/fail summary.', '#panel-test'],
  help: ['Help center', 'Open detailed operational guidance.', '#panel-help']
};

function renderHelpPanel() {
  return `<div class="config-grid"><p><strong>Half-screen target:</strong> 960×1080</p>
  <p><strong>Views:</strong> Fleet (topology + baton + resources), Ops (quotas + router), Resources (inventory), Help.</p>
  <p><strong>Fleet view:</strong> SVG topology, agent baton workflow, OpenClaw/Tailscale/Ollama status.</p>
  <p><a href="https://developer.chrome.com/docs/lighthouse/overview" target="_blank" rel="noopener">Lighthouse docs</a></p>
  <p><a href="https://developer.chrome.com/docs/devtools/memory-problems" target="_blank" rel="noopener">DevTools memory guide</a></p></div>`;
}

function initTooltips(app) {
  const tip = document.getElementById('app-tip');
  let hideTimer = null;

  function showTip(node) {
    if (!app.tooltipsEnabled) return;
    const key = node.dataset.tip;
    const [t, d, h] = TIP_COPY[key] || ['Info', 'No detail', '#'];
    app.activeTip = `<strong>${esc(t)}</strong><p>${esc(d)}</p>`
      + `<a href="${esc(h)}">More info</a>`;
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
