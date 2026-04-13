// Resource Monitor — OpenClaw + Tailscale + Ollama unified view
// Renders real-time resource cards with service endpoints

function renderResourceMonitor(devices, services) {
  const openclaw = services.find(s => s.id === 'openclaw');
  const openclawHtml = openclaw ? renderOpenClawCard(openclaw, devices) : '';
  const tailscaleHtml = renderTailscaleCard(devices);
  const ollamaHtml = renderOllamaCard(devices);
  return `<div class="resource-grid">${openclawHtml}${tailscaleHtml}${ollamaHtml}</div>`;
}

function renderOpenClawCard(svc, devices) {
  const host = devices.find(d => d.openclaw);
  const st = host?.status || 'unknown';
  return `<div class="resource-card">
    <div class="resource-header">
      <span class="resource-icon">⚡</span>
      <strong>OpenClaw Gateway</strong>
      <span class="badge ${st}">${st}</span></div>
    <div class="resource-body">
      <p><span class="label">Host:</span> ${esc(host?.alias || 'unknown')}</p>
      <p><span class="label">Endpoint:</span> <code>${esc(svc.host || '')}</code></p>
      <p><span class="label">Models:</span> ${(svc.models || []).length} proxied</p>
    </div></div>`;
}

function renderTailscaleCard(devices) {
  const connected = devices.filter(d => d.tailscaleIP);
  const total = devices.length;
  return `<div class="resource-card">
    <div class="resource-header">
      <span class="resource-icon">🔗</span>
      <strong>Tailscale Mesh</strong>
      <span class="badge ${connected.length === total ? 'healthy' : 'degraded'}">${connected.length}/${total}</span></div>
    <div class="resource-body">
      ${connected.map(d => `<p class="ts-node">
        <span class="topo-dot-inline" style="background:${statusColor(d.status)}"></span>
        ${esc(d.alias)} — <code>${esc(d.tailscaleIP)}</code>
      </p>`).join('')}
    </div></div>`;
}

function renderOllamaCard(devices) {
  const ollama = devices.filter(d => d.ollama);
  const totalModels = ollama.reduce((s, d) => s + d.modelCount, 0);
  const online = ollama.filter(d => d.status === 'healthy').length;
  return `<div class="resource-card">
    <div class="resource-header">
      <span class="resource-icon">🤖</span>
      <strong>Ollama Fleet</strong>
      <span class="badge ${online === ollama.length ? 'healthy' : 'degraded'}">${online}/${ollama.length}</span></div>
    <div class="resource-body">
      <p><span class="label">Total models:</span> ${totalModels}</p>
      <p><span class="label">Nodes online:</span> ${online}/${ollama.length}</p>
      ${ollama.map(d => `<p>
        <span class="topo-dot-inline" style="background:${statusColor(d.status)}"></span>
        ${esc(d.alias)} (${d.modelCount} models)
      </p>`).join('')}
    </div></div>`;
}
