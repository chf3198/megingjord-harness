/* global esc, maskSecret */

function renderSettingsPanel(resources, probeResults, hostInfo) {
  const hostRow = hostInfo ? renderHostRow(hostInfo) : '';
  if (!resources.length && !hostInfo) return renderEmptySettings();
  const rows = resources.map(r => {
    const probe = (probeResults || []).find(p => p.id === r.id);
    const st = probe?.status || r.status || 'unknown';
    const cls = st === 'healthy' || st === 'ready' ? 'ok'
      : st === 'offline' || st === 'no-key' ? 'err' : 'warn';
    const authCell = maskedAuthCell(r);
    return `<tr class="settings-row">
      <td><span class="dot dot-${cls}"></span> ${esc(r.name)}</td>
      <td>${esc(r.provider)}</td><td>${esc(r.tier)}</td>
      <td>${esc(r.baseUrl)}</td><td>${authCell}</td><td>${st}</td>
      <td><button onclick="openEditModal('${r.id}')">⚙️</button>
       <button onclick="removeResource('${r.id}')">🗑️</button></td>
    </tr>`;
  }).join('');
  return `<table class="settings-table"><thead><tr>
    <th>Name</th><th>Provider</th><th>Tier</th>
    <th>URL</th><th>Auth</th><th>Status</th><th>Actions</th>
  </tr></thead><tbody>${hostRow}${rows}</tbody></table>
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
    <button onclick="openEditModal()">➕ Add Resource</button>
    <button onclick="probeAll()">🔍 Health Check All</button>
    <button onclick="exportConfig()">📤 Export Config</button>
    <label class="btn-label">📥 Import
      <input type="file" accept=".json" onchange="importConfig(event)"
        style="display:none"></label>
  </div>`;
}

function maskedAuthCell(r) {
  const t = r.auth?.type || 'none';
  if (t === 'none') return '<span class="auth-ok">None needed</span>';
  if (!r.auth?.key) {
    return `<span class="auth-missing"
      onclick="openEditModal('${r.id}')" title="Click to add">
      ⚠️ Key needed</span>`;
  }
  const masked = maskSecret(r.auth.key);
  return `<span class="secret-cell">
    <span data-secret-id="${r.id}">${masked}</span>
    <button class="eye-toggle"
      onclick="toggleReveal('${r.id}')" title="Reveal 5s">👁️</button>
  </span>`;
}

function renderHostRow(h) {
  const mem = h.memory || '';
  const info = `${h.platform}/${h.arch} · Node ${h.nodeVersion} · ${mem}`;
  return `<tr class="settings-row host-row">
    <td><span class="dot dot-ok"></span> ${esc(h.hostname)}
      <span class="host-badge">📍 This Device</span></td>
    <td>Dashboard Host</td><td>local</td>
    <td title="${esc(info)}">${esc(info)}</td>
    <td><span class="auth-ok">N/A</span></td>
    <td>up ${esc(h.uptime)}</td><td></td>
  </tr>`;
}

async function fetchHostInfo() {
  try {
    const r = await fetch('/api/host-info');
    return r.ok ? r.json() : null;
  } catch (e) { console.warn('settings-panel: fetchHostInfo failed:', e.message); return null; }
}

Object.assign(window, { renderSettingsPanel, fetchHostInfo });
