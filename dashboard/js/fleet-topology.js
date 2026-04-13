// Fleet Topology — SVG network visualization with legend
// Renders device nodes, Tailscale mesh links, and status indicators

function renderFleetTopology(devices) {
  if (!devices.length) return '<p class="topo-empty">No fleet devices.</p>';
  const W = 680, H = 200, CY = 85;
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
    const mx = (l.a.x + l.b.x) / 2, my = (l.a.y + l.b.y) / 2;
    return `<line x1="${l.a.x}" y1="${l.a.y}" x2="${l.b.x}"
      y2="${l.b.y}" class="${cls}"/>
      <text x="${mx}" y="${my - 8}" text-anchor="middle"
        class="link-label">Tailscale</text>`;
  }).join('');

  const nodesSvg = nodes.map(n => {
    const col = statusColor(n.status);
    const icon = n.openclaw ? '⚡' : n.ollama ? '🤖' : '💻';
    const sub = n.tailscaleIP || 'no route';
    const pulse = n.status === 'healthy'
      ? `<circle cx="${n.x}" cy="${n.y}" r="26"
          class="pulse-ring" style="stroke:${col}"/>` : '';
    return `${pulse}
      <circle cx="${n.x}" cy="${n.y}" r="22" fill="var(--surface)"
        stroke="${col}" stroke-width="2.5" class="topo-node"/>
      <text x="${n.x}" y="${n.y + 5}" text-anchor="middle"
        class="topo-icon">${icon}</text>
      <text x="${n.x}" y="${n.y + 38}" text-anchor="middle"
        class="topo-label">${esc(n.alias)}</text>
      <text x="${n.x}" y="${n.y + 50}" text-anchor="middle"
        class="topo-sub">${esc(sub)}</text>
      <circle cx="${n.x + 16}" cy="${n.y - 16}" r="5"
        fill="${col}" class="topo-dot"/>`;
  }).join('');

  const svg = `<svg viewBox="0 0 ${W} ${H}" class="topo-svg"
    role="img" aria-label="Fleet topology">
    <defs><style>
      .mesh-link{stroke:var(--border);stroke-width:2;stroke-dasharray:6,4}
      .mesh-link.active{stroke:var(--green);stroke-width:2.5;
        stroke-dasharray:none;opacity:.6}
      .link-label{font-size:9px;fill:var(--text-muted);font-style:italic}
      .pulse-ring{fill:none;stroke-width:1;opacity:.3;
        animation:pulse 2s ease-in-out infinite}
      .topo-icon{font-size:16px;fill:var(--text);pointer-events:none}
      .topo-label{font-size:10px;fill:var(--text);font-weight:600}
      .topo-sub{font-size:8px;fill:var(--text-muted)}
      @keyframes pulse{0%,100%{r:26;opacity:.3}50%{r:34;opacity:0}}
    </style></defs>${linksSvg}${nodesSvg}</svg>`;

  const legend = `<div class="topo-legend">
    <span><span class="dot green"></span> Connected</span>
    <span><span class="dot grey"></span> Unreachable</span>
    <span><span class="line green"></span> Mesh link</span>
    <span><span class="line dashed"></span> No route</span></div>`;
  return `<div class="topo-wrap">${svg}${legend}</div>`;
}

function statusColor(s) {
  const m = { healthy: 'var(--green)', degraded: 'var(--yellow)',
    offline: 'var(--red)' };
  return m[s] || 'var(--text-muted)';
}
