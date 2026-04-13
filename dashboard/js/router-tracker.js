// Router metrics tracking for dashboard
let routerMetrics = {
  sessions: {},
  laneDistribution: { free: 0, fleet: 0, premium: 0 }
};

async function loadRouterMetrics() {
  const stateDir = `${process.env.HOME}/.copilot/hooks/state`;
  try {
    const files = await fetch(`file://${stateDir}`).then(r => r.json());
    let free = 0, fleet = 0, premium = 0;
    for (const file of files || []) {
      const state = JSON.parse(file);
      const lane = state.routing?.lane || 'free';
      if (lane === 'free') free++;
      else if (lane === 'fleet') fleet++;
      else premium++;
    }
    return { free, fleet, premium };
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
    return { timestamp: new Date().toISOString(), lanes: { free: 0, fleet: 0, premium: 0 } };
  }
}

function renderRouterPanel(stats) {
  if (!stats) stats = { lanes: { free: 0, fleet: 0, premium: 0 } };
  const { free = 0, fleet = 0, premium = 0 } = stats.lanes || {};
  const total = free + fleet + premium || 1;
  const freeBar = (free/total)*100;
  const fleetBar = (fleet/total)*100;
  const premiumBar = (premium/total)*100;
  return `
    <div class="router-stats">
      <div class="lane-row">
        <span class="lane-label">🟢 Free</span>
        <span class="lane-count">${free}</span>
        <div class="lane-bar"><div class="lane-fill free" style="width: ${freeBar}%"></div></div>
      </div>
      <div class="lane-row">
        <span class="lane-label">🟡 Fleet</span>
        <span class="lane-count">${fleet}</span>
        <div class="lane-bar"><div class="lane-fill fleet" style="width: ${fleetBar}%"></div></div>
      </div>
      <div class="lane-row">
        <span class="lane-label">🔴 Premium</span>
        <span class="lane-count">${premium}</span>
        <div class="lane-bar"><div class="lane-fill premium" style="width: ${premiumBar}%"></div></div>
      </div>
      <p class="router-timestamp">Last update: ${new Date(stats.timestamp).toLocaleTimeString()}</p>
    </div>
  `;
}

async function trackRouterSession(cwd, prompt, route) {
  const key = `session-${Date.now()}`;
  routerMetrics.sessions[key] = { cwd, prompt, route, time: new Date().toISOString() };
}
