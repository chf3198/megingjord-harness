// Fleet Settings — localStorage-backed configuration UI
// Manages fleet IPs, LLM API keys, and service endpoints
const OPENCLAW_DEFAULT_PORT = 4000;
const OLLAMA_DEFAULT_PORT = 11434;

function loadFleetSettings() {
  const defaults = {
    fleetIPs: { 'dev-1': '', 'fleet-host': '', 'local-dev': '' },
    sshUser: 'admin',
    openclawPort: OPENCLAW_DEFAULT_PORT,
    ollamaPort: OLLAMA_DEFAULT_PORT,
    apiKeys: { openrouter: '', groq: '', cerebras: '', google: '', anthropic: '' },
    endpoints: { openclaw: '', cloudflare: '' },
    autoDetect: true
  };
  try {
    const saved = JSON.parse(localStorage.getItem('fleetSettings') || '{}');
    return { ...defaults, fleetIPs: { ...defaults.fleetIPs, ...saved.fleetIPs },
      apiKeys: { ...defaults.apiKeys, ...saved.apiKeys },
      endpoints: { ...defaults.endpoints, ...saved.endpoints },
      sshUser: saved.sshUser || defaults.sshUser,
      openclawPort: saved.openclawPort || defaults.openclawPort,
      ollamaPort: saved.ollamaPort || defaults.ollamaPort,
      autoDetect: saved.autoDetect !== undefined ? saved.autoDetect : true };
  } catch { return defaults; }
}

function saveFleetSettings(settings) {
  localStorage.setItem('fleetSettings', JSON.stringify(settings));
  window.dispatchEvent(new CustomEvent('fleet-settings-changed', { detail: settings }));
}

function renderFleetSettingsPanel() {
  const settings = loadFleetSettings();
  const devices = Object.entries(settings.fleetIPs);
  const keys = Object.entries(settings.apiKeys);
  const maskKey = v => v ? '••••' + v.slice(-4) : '';
  return `<div class="settings-form">
    <h3 style="color:var(--blue);font-size:0.85rem;margin:0 0 8px">Fleet Devices</h3>
    <label><input type="checkbox" ${settings.autoDetect ? 'checked' : ''}
      onchange="toggleAutoDetect(this.checked)"> Auto-detect via Tailscale</label>
    ${devices.map(([id, ip]) => `<label>${id}
      <input type="text" value="${ip}" placeholder="auto-detect"
        ${settings.autoDetect ? 'disabled' : ''}
        onchange="updateFleetIP('${id}', this.value)">
    </label>`).join('')}
    <label>SSH User<input type="text" value="${settings.sshUser}"
      onchange="updateSetting('sshUser', this.value)"></label>
    <h3 style="color:var(--blue);font-size:0.85rem;margin:12px 0 8px">API Keys</h3>
    ${keys.map(([name, val]) => `<label>${name}
      <input type="password" value="${val}" placeholder="${maskKey(val) || 'not set'}"
        onchange="updateAPIKey('${name}', this.value)">
    </label>`).join('')}
  </div>`;
}

function toggleAutoDetect(on) {
  const settings = loadFleetSettings();
  settings.autoDetect = on;
  saveFleetSettings(settings);
}
function updateFleetIP(id, val) {
  const settings = loadFleetSettings();
  settings.fleetIPs[id] = val.trim();
  saveFleetSettings(settings);
}
function updateAPIKey(name, val) {
  const settings = loadFleetSettings();
  settings.apiKeys[name] = val.trim();
  saveFleetSettings(settings);
}
function updateSetting(key, val) {
  const settings = loadFleetSettings();
  settings[key] = val.trim();
  saveFleetSettings(settings);
}
