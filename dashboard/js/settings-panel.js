// Settings Panel — render fleet resource CRUD UI
// Alpine.js integration via global functions

function renderSettingsPanel(resources, probeResults) {
  if (!resources.length) return renderEmptySettings();
  const rows = resources.map(r => {
    const probe = (probeResults || []).find(p => p.id === r.id);
    const st = probe?.status || r.status || 'unknown';
    const cls = st === 'healthy' ? 'ok' : st === 'offline' ? 'err' : 'warn';
    const authBadge = authStatus(r);
    return `<tr class="settings-row">
      <td><span class="dot dot-${cls}"></span> ${esc(r.name)}</td>
      <td>${esc(r.provider)}</td><td>${esc(r.tier)}</td>
      <td>${esc(r.baseUrl)}</td><td>${authBadge}</td><td>${st}</td>
      <td><button onclick="editResource('${r.id}')">✏️</button>
       <button onclick="removeResource('${r.id}')">🗑️</button></td>
    </tr>`;
  }).join('');
  return `<table class="settings-table"><thead><tr>
    <th>Name</th><th>Provider</th><th>Tier</th>
    <th>URL</th><th>Auth</th><th>Status</th><th>Actions</th>
  </tr></thead><tbody>${rows}</tbody></table>
  ${renderSettingsActions()}`;
}

function renderEmptySettings() {
  return `<div class="settings-empty">
    <p>No fleet resources configured yet.</p>
    <p>Click <strong>Add Resource</strong> to connect your first LLM.</p>
    ${renderSettingsActions()}
  </div>`;
}

function renderSettingsActions() {
  return `<div class="settings-actions">
    <button onclick="showAddResource()">➕ Add Resource</button>
    <button onclick="probeAll()">🔍 Health Check All</button>
    <button onclick="exportConfig()">📤 Export Config</button>
    <label class="btn-label">📥 Import
      <input type="file" accept=".json" onchange="importConfig(event)"
        style="display:none"></label>
  </div>`;
}

function esc(s) {
  if (!s) return '';
  const d = document.createElement('div');
  d.textContent = String(s); return d.innerHTML;
}

function authStatus(r) {
  const t = r.auth?.type || 'none';
  if (t === 'none') return '<span class="auth-ok">None needed</span>';
  if (r.auth?.key) return '<span class="auth-ok">🔑 Key set</span>';
  return `<span class="auth-missing" onclick="editResource('${r.id}')" title="Click to add key">⚠️ Key needed</span>`;
}
