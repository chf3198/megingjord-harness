// Router metrics + LLM choice log for dashboard
let routerMetrics = {
  sessions: {},
  laneDistribution: { free: 0, fleet: 0, premium: 0 }
};
let routerLog = [];

async function loadRouterMetrics() {
  try {
    const r = await fetch('/api/router/metrics');
    if (!r.ok) return { free: 0, fleet: 0, premium: 0 };
    const data = await r.json();
    return data.lanes || { free: 0, fleet: 0, premium: 0 };
  } catch {
    return { free: 0, fleet: 0, premium: 0 };
  }
}

async function fetchRouterLaneStats() {
  try {
    const result = await loadRouterMetrics();
    return {
      timestamp: new Date().toISOString(),
      lanes: result
    };
  } catch (e) {
    console.warn('Router metrics unavailable:', e.message);
    return { timestamp: new Date().toISOString(),
      lanes: { free: 0, fleet: 0, premium: 0 } };
  }
}

function addRouterLogEntry(agent, model, task) {
  routerLog.unshift({
    time: new Date().toLocaleTimeString(),
    agent: agent || 'auto',
    model: model || 'unknown',
    task: (task || '').slice(0, 60)
  });
  if (routerLog.length > 20) routerLog.length = 20;
}

function getRouterLog() { return routerLog; }

function renderRouterPanel(stats) {
  if (!stats) stats = { lanes: { free: 0, fleet: 0, premium: 0 } };
  const { free = 0, fleet = 0, premium = 0 } = stats.lanes || {};
  const total = free + fleet + premium || 1;
  return `<div class="router-stats">
    <div class="lane-row"><span class="lane-label">🟢 Free</span>
      <span class="lane-count">${free}</span>
      <div class="lane-bar"><div class="lane-fill free"
        style="width:${(free/total)*100}%"></div></div></div>
    <div class="lane-row"><span class="lane-label">🟡 Fleet</span>
      <span class="lane-count">${fleet}</span>
      <div class="lane-bar"><div class="lane-fill fleet"
        style="width:${(fleet/total)*100}%"></div></div></div>
    <div class="lane-row"><span class="lane-label">🔴 Premium</span>
      <span class="lane-count">${premium}</span>
      <div class="lane-bar"><div class="lane-fill premium"
        style="width:${(premium/total)*100}%"></div></div></div>
    <p class="router-timestamp">Updated:
      ${new Date(stats.timestamp).toLocaleTimeString()}</p>
  </div>`;
}

function renderRouterLog() {
  const log = getRouterLog();
  if (!log.length) return `<div class="router-log-empty">
    <p>No LLM routing decisions recorded yet.</p>
    <p class="config-note">Entries appear when @router
      classifies tasks or agents are invoked.</p></div>`;
  const rows = log.map(e =>
    `<tr><td>${esc(e.time)}</td><td class="log-agent">
      ${esc(e.agent)}</td><td class="log-model">
      ${esc(e.model)}</td></tr>`).join('');
  return `<div class="router-log"><table>
    <thead><tr><th>Time</th><th>Agent</th>
      <th>Model</th></tr></thead>
    <tbody>${rows}</tbody></table></div>`;
}
