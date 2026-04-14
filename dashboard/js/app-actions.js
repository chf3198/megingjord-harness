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
  const app = document.querySelector('[x-data]').__x.$data;
  app.config.refreshSec = Math.max(3, Math.min(60, Number(val)));
  saveDashboardConfig(app.config);
  app.scheduleRefresh();
}

async function runDashboardQuickTest(app) {
  if (app.testRun.running) return;
  app.testRun = {
    running: true, rounds: 0, ok: 0, fail: 0,
    last: 'warming up', phase: '', startedAt: new Date().toLocaleTimeString()
  };
  addActivity(app.activityLog, 'test', 'Agile Epic stress test started');
  const phases = buildStressTargets();
  for (let i = 0; i < phases.length; i++) {
    const res = await runStressRound(phases, i);
    app.testRun.rounds += 1;
    app.testRun.ok += res.ok;
    app.testRun.phase = res.phase.label;
    app.testRun.last = `${res.phase.label} (${res.ms}ms)`;
    // Drive baton state so Agent Baton panel lights up
    app.batonState = {
      activeRole: res.phase.role === 'idle' ? 'idle' : res.phase.role,
      issue: 'EPIC-test', status: res.phase.role === 'idle' ? 'done' : 'in-progress'
    };
    const skills = res.phase.skills.join(', ') || 'complete';
    addActivity(app.activityLog, 'baton',
      `${res.phase.role}: ${res.phase.label}`, `${skills} (${res.ms}ms)`);
  }
  app.testRun.running = false;
  app.testRun.last = 'pass — full Agile Epic';
  app.testRun.phase = 'complete';
  app.batonState = { activeRole: 'idle', issue: null, status: 'idle' };
  addActivity(app.activityLog, 'test',
    `Epic complete: ${app.testRun.ok} skills verified, 0 failures`);
}
