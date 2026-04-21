// Context Flow — SVG diagram with animated data packets
// Accepts live device health + fleet stats for real-time status
function renderContextFlow(devices, fleetStats, isActive) {
  const W = 620, H = 260;
  // Build live status map from device health
  const dm = {}; (devices || []).forEach(d => { dm[d.id] = d.status; });
  const liveMap = {
    'CB-2': dm['chromebook-2'] || 'unknown', 'CB-1': dm['chromebook-1'] || 'unknown',
    'Win Laptop': dm['windows-laptop'] || 'unknown',
    'Tailscale': (dm['chromebook-2'] === 'healthy' ? 'healthy' : 'degraded'),
    'OpenClaw': dm['windows-laptop'] || 'unknown',
    'Ollama': fleetStats?.['windows-laptop']?.online ? 'healthy' : 'offline',
    'VS Code': 'healthy', 'AUTO': 'healthy',
    'Cloud LLM': 'healthy', 'GitHub': 'healthy',
  };
  const nodes = [
    { x: 60, y: 50, icon: '💻', label: 'VS Code', sub: 'Copilot Agent', tip: 'IDE sends prompts with file context, conversation history, and MCP tool results to the AUTO router.' },
    { x: 200, y: 50, icon: '🧠', label: 'AUTO', sub: 'Model Select', tip: 'Routes prompts to Cloud LLM (primary) or OpenClaw (local fallback) based on model availability and rate limits.' },
    { x: 370, y: 50, icon: '☁️', label: 'Cloud LLM', sub: 'Copilot API', tip: 'GitHub Copilot cloud models (GPT-4o, Claude). Primary route. Responses stream back to VS Code.' },
    { x: 540, y: 50, icon: '🐙', label: 'GitHub', sub: 'API + Actions', tip: 'GitHub API: issues, PRs, commits. Actions CI/CD. Context flows bidirectionally via gh CLI and webhooks.' },
    { x: 120, y: 150, icon: '🌐', label: 'Tailscale', sub: 'VPN Mesh', tip: 'Encrypted WireGuard mesh connecting all fleet devices. Routes traffic between Chromebooks and Windows laptop.' },
    { x: 290, y: 150, icon: '⚡', label: 'OpenClaw', sub: 'LiteLLM :4000', tip: 'LiteLLM proxy on Windows laptop. Routes to local Ollama models. Fallback when cloud is rate-limited.' },
    { x: 460, y: 150, icon: '🤖', label: 'Ollama', sub: 'Local 7B', tip: 'Local inference on Windows laptop (16GB RAM). Runs 7B models. Accessed via OpenClaw proxy over Tailscale.' },
    { x: 60, y: 210, icon: '💻', label: 'CB-2', sub: 'This machine', tip: 'Chromebook-2 (penguin): primary dev workstation. 2.7GB RAM. Runs VS Code + dashboard.' },
    { x: 200, y: 210, icon: '💻', label: 'CB-1', sub: 'SLM node', tip: 'Chromebook-1 (penguin-1): runs Ollama with tiny SLM models for lightweight local inference.' },
    { x: 370, y: 210, icon: '🖥️', label: 'Win Laptop', sub: 'OpenClaw host', tip: 'Windows laptop (16GB). Hosts OpenClaw + Ollama. Primary fleet compute for local LLM inference.' },
  ];
  const arrows = [
    { from: 0, to: 1, label: 'prompt', tip: 'User prompt + file context + conversation history sent to model router' },
    { from: 1, to: 2, label: 'cloud', tip: 'Primary route: prompt sent to GitHub Copilot cloud API' },
    { from: 1, to: 5, label: 'local', dashed: true, tip: 'Fallback route: prompt sent to OpenClaw LiteLLM proxy over Tailscale' },
    { from: 5, to: 6, label: 'inference', tip: 'OpenClaw forwards to local Ollama for model inference' },
    { from: 4, to: 5, label: 'mesh', dashed: true, tip: 'Tailscale VPN tunnels traffic between devices' },
    { from: 7, to: 4, label: '', dashed: true, tip: 'CB-2 connects to Tailscale mesh' },
    { from: 8, to: 4, label: '', dashed: true, tip: 'CB-1 connects to Tailscale mesh' },
    { from: 9, to: 5, label: 'host', tip: 'Windows laptop hosts the OpenClaw proxy locally' },
    { from: 0, to: 3, label: 'gh cli', tip: 'VS Code uses gh CLI for issue/PR operations' },
  ];
  return `<div class="cf-wrap"><svg viewBox="0 0 ${W} ${H}" height="${H}" class="cf-svg" role="img" aria-label="Context flow diagram">
    <defs>${cfDefs()}</defs>
    ${cfArrows(nodes, arrows)}${cfNodes(nodes, liveMap)}</svg>
    ${contextBudgetLegend()}</div>`;
}
function cfDefs() {
  return `<marker id="cfHead" markerWidth="6" markerHeight="4"
    refX="6" refY="2" orient="auto">
    <polygon points="0 0, 6 2, 0 4" fill="var(--green)"/></marker>
  <style>.cf-arrow{stroke:var(--green);stroke-width:1.5;opacity:.7}
  .cf-arrow.dashed{stroke-dasharray:4,3;stroke:var(--yellow)}
  .cf-node{fill:var(--surface);stroke:var(--border);stroke-width:1;cursor:pointer}
  .cf-node:hover{stroke:var(--blue);stroke-width:2}
  .cf-icon{font-size:13px;fill:var(--text);pointer-events:none}
  .cf-name{font-size:9px;fill:var(--text);font-weight:600;pointer-events:none}
  .cf-sub{font-size:7px;fill:var(--text-muted);pointer-events:none}
  .cf-lbl{font-size:7px;fill:var(--text-muted);font-style:italic}</style>`;
}
function cfArrows(nodes, arrows) {
  return arrows.map((a, i) => {
    const f = nodes[a.from], t = nodes[a.to];
    const cls = a.dashed ? 'cf-arrow dashed' : 'cf-arrow';
    const mx = (f.x + t.x) / 2, my = (f.y + t.y) / 2;
    const pathId = `cfpath${i}`;
    const color = a.dashed ? 'var(--yellow)' : 'var(--green)';
    const dur = a.dashed ? '4s' : '2.5s';
    const pkt = isActive ? `<circle r="2.5" fill="${color}" class="cf-packet" opacity="0.9">
        <animateMotion dur="${dur}" repeatCount="indefinite">
          <mpath href="#${pathId}"/></animateMotion></circle>` : '';
    return `<path id="${pathId}" d="M${f.x},${f.y} L${t.x},${t.y}"
      class="${cls}" marker-end="url(#cfHead)"><title>${a.tip}</title></path>${pkt}
      ${a.label ? `<text x="${mx}" y="${my - 4}" text-anchor="middle"
        class="cf-lbl">${a.label}</text>` : ''}`;
  }).join('');
}
function cfNodes(nodes, liveMap) {
  const sc = { healthy: 'var(--green)', degraded: 'var(--yellow)', offline: 'var(--red)', unknown: 'var(--text-muted)' };
  return nodes.map(n => {
    const st = (liveMap || {})[n.label] || 'unknown';
    const c = sc[st] || sc.unknown;
    return `<g class="cf-node-g">
    <rect x="${n.x - 36}" y="${n.y - 20}" width="72" height="40"
      rx="6" class="cf-node"><title>${n.tip}</title></rect>
    <circle cx="${n.x + 30}" cy="${n.y - 14}" r="4" fill="${c}" class="${st === 'healthy' ? 'cf-pulse' : ''}"><title>${n.label}: ${st}</title></circle>
    <text x="${n.x}" y="${n.y - 4}" text-anchor="middle" class="cf-icon">${n.icon}</text>
    <text x="${n.x}" y="${n.y + 8}" text-anchor="middle" class="cf-name">${n.label}</text>
    <text x="${n.x}" y="${n.y + 18}" text-anchor="middle" class="cf-sub">${n.sub}</text>
  </g>`; }).join('');
}
function contextBudgetLegend() {
  const items = [
    { label: 'System prompt', pct: 10, color: 'var(--blue)' },
    { label: 'Conversation', pct: 35, color: 'var(--green)' },
    { label: 'File context', pct: 25, color: 'var(--yellow)' },
    { label: 'MCP tools', pct: 10, color: 'var(--text-muted)' },
    { label: 'User message', pct: 5, color: 'var(--red)' },
    { label: 'Headroom', pct: 15, color: 'var(--border)' }, ];
  const bars = items.map(i => `<div class="cb-seg" style="flex:${i.pct};background:${i.color}" title="${i.label}: ~${i.pct}%"></div>`).join('');
  const labels = items.map(i => `<span><span class="dot" style="background:${i.color}"></span>${i.label}</span>`).join('');
  return `<div class="cb-bar">${bars}</div><div class="cb-legend">${labels}</div>`;
}
