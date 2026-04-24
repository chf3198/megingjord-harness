// Fleet Settings — localStorage-backed configuration UI
// Manages fleet IPs, LLM API keys, and service endpoints

function loadFleetSettings() {
  const defaults = {
    fleetIPs: { 'penguin-1': '', 'windows-laptop': '', 'chromebook-2': '' },
    sshUser: 'admin', openclawPort: 4000, ollamaPort: 11434,
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
  const s = loadFleetSettings();
  const devices = Object.entries(s.fleetIPs);
  const keys = Object.entries(s.apiKeys);
  const maskKey = v => v ? '••••' + v.slice(-4) : '';
  return `<div class="settings-form">
    <h3 style="color:var(--blue);font-size:0.85rem;margin:0 0 8px">Fleet Devices</h3>
    <label><input type="checkbox" ${s.autoDetect ? 'checked' : ''}
      onchange="toggleAutoDetect(this.checked)"> Auto-detect via Tailscale</label>
    ${devices.map(([id, ip]) => `<label>${id}
      <input type="text" value="${ip}" placeholder="auto-detect"
        ${s.autoDetect ? 'disabled' : ''}
        onchange="updateFleetIP('${id}', this.value)">
    </label>`).join('')}
    <label>SSH User<input type="text" value="${s.sshUser}"
      onchange="updateSetting('sshUser', this.value)"></label>
    <h3 style="color:var(--blue);font-size:0.85rem;margin:12px 0 8px">API Keys</h3>
    ${keys.map(([name, val]) => `<label>${name}
      <input type="password" value="${val}" placeholder="${maskKey(val) || 'not set'}"
        onchange="updateAPIKey('${name}', this.value)">
    </label>`).join('')}
  </div>`;
}

function toggleAutoDetect(on) {
  const s = loadFleetSettings(); s.autoDetect = on; saveFleetSettings(s);
}
function updateFleetIP(id, val) {
  const s = loadFleetSettings(); s.fleetIPs[id] = val.trim(); saveFleetSettings(s);
}
function updateAPIKey(name, val) {
  const s = loadFleetSettings(); s.apiKeys[name] = val.trim(); saveFleetSettings(s);
}
function updateSetting(key, val) {
  const s = loadFleetSettings(); s[key] = val.trim(); saveFleetSettings(s);
}
