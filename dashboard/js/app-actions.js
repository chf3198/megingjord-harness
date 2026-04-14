// Dashboard actions split out to keep app.js compact

function setDashboardView(app, view) {
  app.currentView = view;
}

function isDashboardView(app, view) {
  return app.currentView === view;
}

function toggleDashboardTips(app) {
  app.tooltipsEnabled = !app.tooltipsEnabled;
  app.config.tooltipsEnabled = app.tooltipsEnabled;
  saveDashboardConfig(app.config);
  if (!app.tooltipsEnabled) clearTooltip(app);
}

// Global — called from config panel range slider
function setRefreshSec(val) {
  const el = document.querySelector('[x-data]');
  const app = el._x_dataStack?.[0] || Alpine.$data(el);
  app.config.refreshSec = Math.max(3, Math.min(60, Number(val)));
  saveDashboardConfig(app.config);
  app.scheduleRefresh();
}

async function runDashboardQuickTest(app) {
  if (app.testRun.running) return;
  const tickets = buildParallelTickets();
  app.testRun = {
    running: true, rounds: 0, ok: 0, fail: 0,
    last: 'warming up', phase: '', tickets,
    startedAt: new Date().toLocaleTimeString()
  };
  addActivity(app.activityLog, 'test', 'Parallel ticket stress test started',
    `${tickets.length} tickets`);
  const maxRounds = 15;
  for (let i = 0; i < maxRounds; i++) {
    await new Promise(r => setTimeout(r, 200 + Math.random() * 150));
    // Advance a random non-done ticket
    const active = tickets.filter(t => t.status !== 'done');
    if (!active.length) break;
    const t = active[Math.floor(Math.random() * active.length)];
    advanceTicket(t);
    app.testRun.rounds = i + 1;
    app.testRun.ok += t.skills.length;
    app.testRun.last = `${t.id}: ${t.role}`;
    app.testRun.tickets = [...tickets];
    const agent = AGENT_NAMES[t.role] || 'system';
    app.batonState = {
      activeRole: t.role === 'done' ? 'idle' : t.role,
      issue: t.id, status: t.role === 'done' ? 'done' : 'in-progress',
      agent
    };
    addActivity(app.activityLog, 'baton',
      `[${agent}] ${t.id}: ${t.label}`, t.role);
  }
  app.testRun.running = false;
  app.testRun.last = `pass — ${tickets.length} tickets complete`;
  app.batonState = { activeRole: 'idle', issue: null, status: 'idle' };
  addActivity(app.activityLog, 'test',
    `All tickets complete: ${app.testRun.ok} skills verified`);
}
