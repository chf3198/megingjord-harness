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

async function runDashboardQuickTest(app) {
  if (app.testRun.running) return;
  app.testRun = {
    running: true, rounds: 0, ok: 0, fail: 0,
    last: 'warming up', startedAt: new Date().toLocaleTimeString()
  };
  addActivity(app.activityLog, 'test', 'Stress test started');
  const targets = buildStressTargets(app.devices);
  const rounds = 12;
  for (let i = 0; i < rounds; i++) {
    const res = await runStressRound(targets);
    app.testRun.rounds += 1;
    app.testRun.ok += res.ok;
    app.testRun.fail += res.fail;
    app.testRun.last = `round ${i + 1}/${rounds} • ${res.ms}ms`;
  }
  app.testRun.running = false;
  app.testRun.last = app.testRun.fail ? 'completed with warnings' : 'pass';
  addActivity(app.activityLog, 'test',
    `Test done: ${app.testRun.ok} ok, ${app.testRun.fail} fail`);
}
