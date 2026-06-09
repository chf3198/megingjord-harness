// fixture-runner.js — JSONL scenario replay engine for demo mode
// Drives activityLog and batonState from scenario event files.

var fixtureRunner = (function () {
  'use strict';

  var FIXTURE_BASE = 'fixtures/';
  var TICK_MS = 1200;
  var _timer = null;
  var _events = [];
  var _idx = 0;
  var _app = null;

  async function loadScenario(name) {
    var meta = await fetch(FIXTURE_BASE + 'meta.json').then(function (r) { return r.json(); });
    var s = meta.scenarios.find(function (sc) { return sc.name === name; }) || meta.scenarios[0];
    var text = await fetch(FIXTURE_BASE + s.file).then(function (r) { return r.text(); });
    return text.trim().split('\n').filter(Boolean).map(function (l) { return JSON.parse(l); });
  }

  function applyEvent(app, ev) {
    if (ev.type === 'baton') {
      var existing = (app.batonState || []).filter(function (b) { return b.issue !== ev.issue; });
      app.batonState = existing.concat([ev]);
      return;
    }
    var typeMap = { warn: 'warn', llm: 'llm', tool: 'tool', agent: 'agent', system: 'system' };
    var t = typeMap[ev.type] || 'system';
    var msg = ev.message || ev.type.replace(/_/g, ' ');
    var detail = ev.detail || '';
    if (typeof addActivity === 'function') {
      addActivity(app.activityLog, t, msg, detail);
    } else if (app.activityLog) {
      app.activityLog.unshift({ type: t, message: msg, detail: detail, ts: Date.now() });
      if (app.activityLog.length > 100) app.activityLog.pop();
    }
  }

  function tick() {
    if (!_app || !_events.length) return;
    applyEvent(_app, _events[_idx % _events.length]);
    _idx++;
  }

  async function start(app, scenarioName) {
    _app = app;
    stop();
    _events = await loadScenario(scenarioName || 'healthy-session');
    _idx = 0;
    _timer = setInterval(tick, TICK_MS);
  }

  function stop() {
    if (_timer) { clearInterval(_timer); _timer = null; }
  }

  async function switchScenario(name) {
    var wasRunning = !!_timer;
    stop();
    _events = await loadScenario(name);
    _idx = 0;
    if (wasRunning && _app) _timer = setInterval(tick, TICK_MS);
  }

  return { start: start, stop: stop, switch: switchScenario };
})();

window.fixtureRunner = fixtureRunner;
