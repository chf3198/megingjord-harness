// Fleet Topology — SVG network visualization with live status
// Renders device nodes, Tailscale mesh links, and service overlays

function renderFleetTopology(devices) {
  if (!devices.length) return '<p class="topo-empty">No fleet devices.</p>';
  const W = 680, H = 260, CY = 130;
  const nodes = devices.map((d, i) => {
    const x = 100 + i * ((W - 200) / Math.max(devices.length - 1, 1));
    return { ...d, x, y: CY };
  });
  const links = [];
  for (let i = 0; i < nodes.length; i++)
    for (let j = i + 1; j < nodes.length; j++)
      if (nodes[i].tailscaleIP && nodes[j].tailscaleIP)
        links.push({ a: nodes[i], b: nodes[j] });

  const linksSvg = links.map(l => {
    const on = l.a.status === 'healthy' && l.b.status === 'healthy';
    const cls = on ? 'mesh-link active' : 'mesh-link';
    return `<line x1="${l.a.x}" y1="${l.a.y}" x2="${l.b.x}" y2="${l.b.y}" class="${cls}"/>`;
  }).join('');

  const nodesSvg = nodes.map(n => {
    const col = statusColor(n.status);
    const pulse = n.status === 'healthy' ? `<circle cx="${n.x}" cy="${n.y}" r="30" class="pulse-ring" style="stroke:${col}"/>` : '';
    const icon = n.openclaw ? '⚡' : n.ollama ? '🤖' : '💻';
    return `${pulse}
      <circle cx="${n.x}" cy="${n.y}" r="24" fill="var(--surface)" stroke="${col}" stroke-width="2.5" class="topo-node"/>
      <text x="${n.x}" y="${n.y + 5}" text-anchor="middle" class="topo-icon">${icon}</text>
      <text x="${n.x}" y="${n.y + 42}" text-anchor="middle" class="topo-label">${esc(n.alias)}</text>
      <text x="${n.x}" y="${n.y + 56}" text-anchor="middle" class="topo-sub">${esc(n.role)}</text>
      <circle cx="${n.x + 18}" cy="${n.y - 18}" r="5" fill="${col}" class="topo-dot"/>`;
  }).join('');

  return `<div class="topo-wrap"><svg viewBox="0 0 ${W} ${H}" class="topo-svg" role="img" aria-label="Fleet topology">
    <defs><style>
      .mesh-link{stroke:var(--border);stroke-width:1.5;stroke-dasharray:6,4}
      .mesh-link.active{stroke:var(--green);stroke-dasharray:none;opacity:.5}
      .pulse-ring{fill:none;stroke-width:1;opacity:.3;animation:pulse 2s ease-in-out infinite}
      .topo-icon{font-size:18px;fill:var(--text);pointer-events:none}
      .topo-label{font-size:11px;fill:var(--text);font-weight:600}
      .topo-sub{font-size:9px;fill:var(--text-muted)}
      @keyframes pulse{0%,100%{r:30;opacity:.3}50%{r:38;opacity:0}}
    </style></defs>
    ${linksSvg}${nodesSvg}
  </svg></div>`;
}

function statusColor(s) {
  const m = { healthy: 'var(--green)', degraded: 'var(--yellow)', offline: 'var(--red)' };
  return m[s] || 'var(--text-muted)';
}
