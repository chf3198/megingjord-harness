// Context Flow — SVG diagram showing prompt → LLM → response chain
// Renders in the Fleet view as a visual architecture map

function renderContextFlow() {
  const W = 460, H = 200;
  const nodes = [
    { x: 50, y: 40, icon: '💻', label: 'VS Code', sub: 'Copilot Agent' },
    { x: 170, y: 40, icon: '🧠', label: 'AUTO', sub: 'Model Select' },
    { x: 300, y: 40, icon: '☁️', label: 'Cloud LLM', sub: 'Copilot API' },
    { x: 300, y: 140, icon: '⚡', label: 'OpenClaw', sub: 'LiteLLM Proxy' },
    { x: 430, y: 140, icon: '🤖', label: 'Ollama', sub: 'Local Models' },
  ];
  const arrows = [
    { from: 0, to: 1, label: 'prompt + context' },
    { from: 1, to: 2, label: 'cloud route' },
    { from: 1, to: 3, label: 'local route', dashed: true },
    { from: 3, to: 4, label: 'inference' },
  ];

  const arrowsSvg = arrows.map(a => {
    const f = nodes[a.from], t = nodes[a.to];
    const cls = a.dashed ? 'cf-arrow dashed' : 'cf-arrow';
    const mx = (f.x + t.x) / 2, my = (f.y + t.y) / 2;
    return `<line x1="${f.x}" y1="${f.y}" x2="${t.x}" y2="${t.y}"
      class="${cls}" marker-end="url(#cfHead)"/>
      <text x="${mx}" y="${my - 5}" text-anchor="middle"
        class="cf-lbl">${a.label}</text>`;
  }).join('');

  const nodesSvg = nodes.map(n => `
    <rect x="${n.x - 30}" y="${n.y - 18}" width="60" height="36"
      rx="6" class="cf-node"/>
    <text x="${n.x}" y="${n.y - 3}" text-anchor="middle"
      class="cf-icon">${n.icon}</text>
    <text x="${n.x}" y="${n.y + 10}" text-anchor="middle"
      class="cf-name">${n.label}</text>
    <text x="${n.x}" y="${n.y + 26}" text-anchor="middle"
      class="cf-sub">${n.sub}</text>`).join('');

  return `<div class="cf-wrap"><svg viewBox="0 0 ${W} ${H}"
    class="cf-svg" role="img" aria-label="Context flow diagram">
    <defs>
      <marker id="cfHead" markerWidth="6" markerHeight="4"
        refX="6" refY="2" orient="auto">
        <polygon points="0 0, 6 2, 0 4" fill="var(--green)"/>
      </marker>
      <style>
        .cf-arrow{stroke:var(--green);stroke-width:1.5;opacity:.7}
        .cf-arrow.dashed{stroke-dasharray:4,3;stroke:var(--yellow)}
        .cf-node{fill:var(--surface);stroke:var(--border);stroke-width:1}
        .cf-icon{font-size:14px;fill:var(--text)}
        .cf-name{font-size:7px;fill:var(--text);font-weight:600}
        .cf-sub{font-size:5.5px;fill:var(--text-muted)}
        .cf-lbl{font-size:5.5px;fill:var(--text-muted);font-style:italic}
      </style>
    </defs>${arrowsSvg}${nodesSvg}</svg>
    ${contextBudgetLegend()}</div>`;
}

function contextBudgetLegend() {
  const items = [
    { label: 'System prompt', pct: 10, color: 'var(--blue)' },
    { label: 'Conversation', pct: 35, color: 'var(--green)' },
    { label: 'File context', pct: 25, color: 'var(--yellow)' },
    { label: 'MCP tools', pct: 10, color: 'var(--text-muted)' },
    { label: 'User message', pct: 5, color: 'var(--red)' },
    { label: 'Headroom', pct: 15, color: 'var(--border)' },
  ];
  const bars = items.map(i => `<div class="cb-seg"
    style="flex:${i.pct};background:${i.color}"
    title="${i.label}: ~${i.pct}%"></div>`).join('');
  const labels = items.map(i =>
    `<span><span class="dot" style="background:${i.color}"></span>
    ${i.label}</span>`).join('');
  return `<div class="cb-bar">${bars}</div>
    <div class="cb-legend">${labels}</div>`;
}
