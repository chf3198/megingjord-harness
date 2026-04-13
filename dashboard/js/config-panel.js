// Config Panel — local dashboard preferences

function loadDashboardConfig() {
  try {
    const raw = localStorage.getItem('devenv-dashboard-config');
    if (!raw) return { refreshSec: 60, highContrast: false };
    const cfg = JSON.parse(raw);
    return {
      refreshSec: Number(cfg.refreshSec || 60),
      highContrast: !!cfg.highContrast
    };
  } catch {
    return { refreshSec: 60, highContrast: false };
  }
}

function saveDashboardConfig(config) {
  localStorage.setItem('devenv-dashboard-config', JSON.stringify(config));
}

function renderConfigPanel(config, enabled) {
  const status = enabled ? 'Enabled' : 'Paused';
  return `<div class="config-grid">
    <p><strong>Auto refresh:</strong> ${status} (${config.refreshSec}s)</p>
    <p><strong>High contrast:</strong> ${config.highContrast ? 'On' : 'Off'}</p>
    <p class="config-note">Use ⏱️ Auto button to pause/resume.</p>
  </div>`;
}
