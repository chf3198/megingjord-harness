// Tooltips + Help panel — pure Alpine reactive state

const TIP_COPY = {
  refresh: ['Manual refresh', 'Polls all endpoints immediately.', '#panel-router'],
  auto: ['Auto refresh', 'Pauses or resumes polling.', '#panel-config'],
  test: ['Quick stress test', 'Runs 12 lightweight endpoint rounds.', '#panel-test'],
  tips: ['Tooltip mode', 'Toggle contextual UX help.', '#panel-help'],
  contrast: ['Contrast mode', 'Switches high-contrast theme.', '#panel-config'],
  'view-ops': ['Ops view', 'Runtime health, quotas, and router.', '#panel-router'],
  'view-resources': ['Resources view', 'Devices and services inventory.', '#panel-devices'],
  'view-help': ['Help view', 'Detailed guidance and links.', '#panel-help'],
  devices: ['Fleet devices', 'Tailscale + Ollama/OpenClaw status cards.', '#panel-devices'],
  services: ['Service inventory', 'Paid, free-tier, and self-hosted services.', '#panel-services'],
  quotas: ['Quota tracking', 'Live and static usage bars.', '#panel-quotas'],
  stats: ['Live stats', 'Running model/process snapshots.', '#panel-stats'],
  router: ['Task lanes', 'Free/Fleet/Premium lane mix.', '#panel-router'],
  config: ['Settings', 'Refresh, contrast, and tooltip prefs.', '#panel-config'],
  'test-panel': ['Stress test output', 'Per-round pass/fail summary.', '#panel-test'],
  help: ['Help center', 'Open detailed operational guidance.', '#panel-help']
};

function renderHelpPanel() {
  return `<div class="config-grid"><p><strong>Half-screen target:</strong> 960×1080</p>
  <p><strong>Views:</strong> Ops, Resources, Help (x-if removes inactive DOM).</p>
  <p><strong>Google QA:</strong> Use Lighthouse, DevTools Performance, Memory, Issues.</p>
  <p><a href="https://developer.chrome.com/docs/lighthouse/overview" target="_blank" rel="noopener">Lighthouse docs</a></p>
  <p><a href="https://developer.chrome.com/docs/devtools/memory-problems" target="_blank" rel="noopener">DevTools memory guide</a></p></div>`;
}

function initTooltips(app) {
  document.addEventListener('mouseover', e => {
    if (!app.tooltipsEnabled) return;
    const node = e.target.closest('[data-tip]');
    if (!node) { app.activeTip = ''; return; }
    const [t, d, h] = TIP_COPY[node.dataset.tip] || ['Info', 'No detail', '#'];
    app.activeTip = `<strong>${esc(t)}</strong><p>${esc(d)}</p><a href="${esc(h)}">More info</a>`;
  });
  document.addEventListener('mouseout', e => {
    if (e.target.closest('[data-tip]')) app.activeTip = '';
  });
}

function clearTooltip(app) { app.activeTip = ''; }
