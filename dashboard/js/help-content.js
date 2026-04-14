// Help Content — user + developer views with search

const HELP_SECTIONS = [
  { id: 'fleet', title: '🌐 Fleet Topology',
    user: 'Network graph of fleet devices. Green = reachable. Mesh lines show Tailscale connections between healthy nodes.',
    dev: 'Rendered by renderFleetTopology() in fleet-topology.js. SVG 400×120 viewBox. Filters devices without tailscaleIP. Data: inventory/devices.json merged with health-check.js ping results. statusColor() maps health→CSS var.' },
  { id: 'baton', title: '🔄 Agent Baton Flow',
    user: 'Shows the Agile workflow: Manager → Collaborator → Admin → Consultant. Active role lights up during work.',
    dev: 'renderBatonFlow() in baton-flow.js. State from buildBatonState(getRouterLog()) in app.js refreshAll(). During stress test, app-actions.js directly sets app.batonState per phase. 4 roles with done/active/pending CSS states.' },
  { id: 'activity', title: '📡 Live Activity Feed',
    user: 'Timestamped log of dashboard events: refreshes, test rounds, baton transitions. Max 15 entries.',
    dev: 'addActivity() in activity-feed.js, capped at MAX_ACTIVITY=15. Rendered by renderActivityFeed(). Types: refresh, test, baton, router, system, error, warn. Each has icon mapping in activityIcon().' },
  { id: 'resources', title: '⚡ Remote Resources',
    user: 'OpenClaw gateway, Tailscale mesh, and Ollama fleet status cards.',
    dev: 'resource-monitor.js renders 3 res-card elements in a resource-stack. Data: inventory/services.json (openclaw entry) + devices array. Compact single-line layout for half-width column.' },
  { id: 'quotas', title: '📊 Quotas (Ops)',
    user: 'API quota usage bars for free-tier services. Yellow above 80%.',
    dev: 'renderQuotaPanel() in render-panels.js. Live quotas from quota-live.js fetchAllLiveQuotas(). Static from buildQuotaList() in quota-tracker.js. Progress bars use .progress-fill.warn CSS class.' },
  { id: 'router', title: '🛣️ Task Router (Ops)',
    user: 'Lane distribution: Free (local), Fleet (OpenClaw), Premium (Copilot). Shows recent LLM routing decisions.',
    dev: 'renderRouterPanel() + renderRouterLog() in render-panels.js. Stats from router-tracker.js fetchRouterLaneStats(). Log from live-stats.js getRouterLog(). 8 agents defined in agents/*.agent.md.' },
  { id: 'controls', title: '🎛️ Header Controls',
    user: '↻ Refresh all · ⏱️ Auto-refresh (configurable interval) · 🧪 Agile Epic test · 💡 Tooltips · ◐ Contrast · ❓ Tour',
    dev: 'Buttons in index.html header-actions. Handlers in app-actions.js. Config persisted via config-panel.js loadDashboardConfig()/saveDashboardConfig() to localStorage. Tour uses Driver.js CDN in help-tour.js.' },
  { id: 'views', title: '📋 View Navigation',
    user: 'Fleet (2×2 grid), Ops (quotas+router+settings), Resources (device/service cards), Help (this page).',
    dev: 'Alpine x-if for Fleet/Resources/Help (DOM removal). x-show for Ops (no CLS). setDashboardView()/isDashboardView() in app-actions.js. 2-col grid in app.css.' },
  { id: 'data', title: '🗄️ Data Sources',
    user: '3 devices, 7 services from JSON inventory. Health checks with 2.5s timeout. Auto-refresh cycle.',
    dev: 'inventory/devices.json + inventory/services.json loaded by device-monitor.js loadDevices()/loadServices(). Health via health-check.js runHealthChecks(). 33 skills in skills/*, 12 instructions, 18 hooks, 17 global scripts, 8 agents.' },
  { id: 'perf', title: '⚡ Performance',
    user: 'Targets: DOM < 2000 nodes, heap < 50 MB, 960×1080 viewport. No build step.',
    dev: 'Playwright CDP tests in google-quality.spec.js. ScriptDuration < 3s, TaskDuration < 5s, LayoutCount < 50. Alpine.js deferred from CDN. content-visibility:auto on .panel elements.' }
];

function getHelpSections(devMode) {
  return HELP_SECTIONS.map(s => ({
    id: s.id, title: s.title,
    body: devMode ? s.user + '<br><br><strong>🔧 Dev:</strong> ' + s.dev : s.user
  }));
}
