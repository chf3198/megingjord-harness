// Fleet Topology — compact SVG network graph
// Only shows routable devices; legend inline

function renderFleetTopology(devices) {
  if (!devices.length) return '<p class="topo-empty">No fleet devices.</p>';
  const routable = devices.filter(d => d.tailscaleIP);
  const unroutable = devices.filter(d => !d.tailscaleIP);
  const W = 400, H = 120, CY = 55;
  const nodes = routable.map((d, i) => {
    const x = 80 + i * ((W - 160) / Math.max(routable.length - 1, 1));
    return { ...d, x, y: CY };
  });
  const links = [];
  for (let i = 0; i < nodes.length; i++)
    for (let j = i + 1; j < nodes.length; j++)
      links.push({ a: nodes[i], b: nodes[j] });

  const linksSvg = links.map(l => {
    const on = l.a.status === 'healthy' && l.b.status === 'healthy';
    const cls = on ? 'mesh-link active' : 'mesh-link';
    const mx = (l.a.x + l.b.x) / 2, my = (l.a.y + l.b.y) / 2;
    return `<line x1="${l.a.x}" y1="${l.a.y}" x2="${l.b.x}"
      y2="${l.b.y}" class="${cls}"/>
      <text x="${mx}" y="${my - 6}" text-anchor="middle"
        class="link-label">Tailscale</text>`;
  }).join('');

  const nodesSvg = nodes.map(n => {
    const col = statusColor(n.status);
    const icon = n.openclaw ? '⚡' : n.ollama ? '🤖' : '💻';
    return `<circle cx="${n.x}" cy="${n.y}" r="18" fill="var(--surface)"
        stroke="${col}" stroke-width="2" class="topo-node"/>
      <text x="${n.x}" y="${n.y + 4}" text-anchor="middle"
        class="topo-icon">${icon}</text>
      <text x="${n.x}" y="${n.y + 32}" text-anchor="middle"
        class="topo-label">${esc(n.alias)}${n.local ? ' ⭐' : ''}</text>
      <text x="${n.x}" y="${n.y + 42}" text-anchor="middle"
        class="topo-sub">${esc(n.tailscaleIP)}</text>
      <circle cx="${n.x + 13}" cy="${n.y - 13}" r="4"
        fill="${col}" class="topo-dot"/>`;
  }).join('');

  const svg = `<svg viewBox="0 0 ${W} ${H}" class="topo-svg"
    role="img" aria-label="Fleet topology">
    <defs><style>
      .mesh-link{stroke:var(--border);stroke-width:1.5;stroke-dasharray:5,3}
      .mesh-link.active{stroke:var(--green);stroke-width:2;
        stroke-dasharray:none;opacity:.6}
      .link-label{font-size:8px;fill:var(--text-muted);font-style:italic}
      .topo-icon{font-size:14px;fill:var(--text);pointer-events:none}
      .topo-label{font-size:9px;fill:var(--text);font-weight:600}
      .topo-sub{font-size:7px;fill:var(--text-muted)}
    </style></defs>${linksSvg}${nodesSvg}</svg>`;

  const unr = unroutable.length
    ? `<span class="topo-unr">${unroutable.map(
        d => esc(d.alias)).join(', ')} (no route)</span>` : '';
  const legend = `<div class="topo-legend">
    <span><span class="dot green"></span> Online</span>
    <span><span class="line green"></span> Mesh</span>
    ${unr}</div>`;
  return `<div class="topo-wrap">${svg}${legend}</div>`;
}

function statusColor(s) {
  const m = { healthy: 'var(--green)', degraded: 'var(--yellow)',
    offline: 'var(--red)' };
  return m[s] || 'var(--text-muted)';
}
