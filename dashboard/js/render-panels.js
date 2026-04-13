// Render Panels — JS template functions for Alpine x-html
// Returns HTML strings, re-evaluated reactively by Alpine

function esc(s) {
  if (s == null) return '';
  return String(s).replace(/&/g, '&amp;')
    .replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;')
    .replace(/`/g, '&#96;');
}

function renderDeviceCards(devices) {
  if (!devices.length) {
    return '<div class="card"><p>No devices loaded yet.</p></div>';
  }
  return devices.map(d => `<div class="card device-card ${d.status}">
    <div class="card-header"><strong>${esc(d.alias)}</strong>
      <span class="badge ${d.status}">${d.status}</span></div>
    <div class="card-body">
      <p><span class="label">Role:</span> ${esc(d.role)}</p>
      <p><span class="label">RAM:</span> ${esc(d.ram)}</p>
      <p><span class="label">Models:</span> ${d.modelCount} loaded</p>
    </div></div>`).join('');
}

function renderServiceCards(services) {
  if (!services.length) {
    return '<div class="card"><p>No services loaded yet.</p></div>';
  }
  return services.map(s => `<div class="card service-card ${s.status}">
    <div class="card-header"><strong>${esc(s.name)}</strong>
      <span class="badge ${s.status}">${s.status}</span></div>
    <div class="card-body">
      <p><span class="label">Type:</span> ${esc(s.type)}</p>
      <p><span class="label">Cost:</span> ${esc(s.cost)}</p>
    </div></div>`).join('');
}

function renderQuotaPanel(live, statics) {
  if (!live.length && !statics.length) {
    return '<div class="card"><p>Quota sources unavailable.</p></div>';
  }
  const a = live.map(q => `<div class="quota-live-card">
    <div class="card-header"><strong>${esc(q.name)}</strong>
      <span>${q.used}/${q.limit}</span></div>
    <div class="progress-bar"><div class="progress-fill
      ${q.percent > 80 ? 'warn' : 'ok'}"
      style="width:${q.percent}%"></div></div>
    <span class="quota-meta">${esc(q.period)}</span></div>`).join('');
  const b = statics.map(q => `<div class="card quota-card">
    <div class="card-header"><strong>${esc(q.name)}</strong>
      <span>${q.usage}/${q.limit}</span></div>
    <div class="progress-bar"><div class="progress-fill
      ${q.percent > 80 ? 'warn' : 'ok'}"
      style="width:${q.percent}%"></div></div>
    </div>`).join('');
  return a + b;
}

function renderFleetStats(stats) {
  const rows = Object.entries(stats);
  if (!rows.length) return '<div class="stat-card"><p class="stat-offline">No live stats yet.</p></div>';
  return rows.map(([id, st]) => {
    if (!st.online) return `<div class="stat-card">
      <div class="stat-header"><strong>${esc(id)}</strong></div>
      <p class="stat-offline">Device offline</p></div>`;
    const pct = Math.min(100, st.running.length * 33);
    const ver = st.version
      ? `<span class="version">v${esc(st.version)}</span>` : '';
    const models = st.models.map(m => {
      const dot = st.running.some(r => r.name === m.name)
        ? '<span class="active-dot">●</span>' : '';
      return `<li><span>${dot}${esc(m.name)}</span>
        <span>${esc(m.params)} ${esc(m.quant)}</span></li>`;
    }).join('');
    return `<div class="stat-card">
      <div class="stat-header">
        <strong>${esc(id)}</strong>${ver}</div>
      <div class="stat-row">
        <div class="gauge" style="background:conic-gradient(
          var(--green) ${pct}%,var(--border) 0)">
          <div class="gauge-inner">${st.running.length}</div></div>
        <div><div>${st.models.length} models</div>
          <div style="font-size:.8rem;color:var(--text-muted)">
            ${st.running.length} running</div></div>
      </div>
      <ul class="model-list">${models}</ul></div>`;
  }).join('');
}
