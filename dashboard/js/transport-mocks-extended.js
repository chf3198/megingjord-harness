/* transport-mocks-extended.js — additional IS_DEMO mocks loaded after transport-mocks.js */
/* Refs #2835 */
if (window.IS_DEMO) (function () {
  'use strict';
  const DEMO_TICKET = 2809;

  /* getBatonState — honours window._demoFixtureBatonState set by fixture-runner
   * so scenario replay controls baton without the 5s refresh loop overwriting it. */
  window.getBatonState = function () {
    if (window._demoFixtureBatonState && window._demoFixtureBatonState.length) {
      return window._demoFixtureBatonState;
    }
    return [
      { role: 'manager',      issue: DEMO_TICKET, message: 'Scoping ACs + gates',     ts: Date.now() - 14000 },
      { role: 'collaborator', issue: DEMO_TICKET, message: 'Implementation active',    ts: Date.now() - 9000 },
      { role: 'admin',        issue: DEMO_TICKET, message: 'CI gates running',         ts: Date.now() - 4500 },
    ];
  };

  /* getTicketLog — synchronous; returns demo ticket entries. */
  window.getTicketLog = function () {
    return [
      { id: DEMO_TICKET, title: 'Demo Mode Quality Sprint', status: 'in-progress', role: 'collaborator' },
      { id: DEMO_TICKET - 1, title: 'Fix demo device IDs', status: 'done', role: null },
    ];
  };

  /* loadWikiPages — async; returns demo wiki page stubs. */
  window.loadWikiPages = async function () {
    return [
      { title: 'Harness Goals', path: 'wiki/wisdom/global/concepts/harness-goal-controls.md', fresh: true },
      { title: 'Role Baton Routing', path: 'wiki/wisdom/global/concepts/role-baton-routing.md', fresh: true },
      { title: 'Demo Mode Overview', path: 'wiki/wisdom/global/concepts/demo-mode.md', fresh: true },
    ];
  };

  /* getRouterLog — synchronous; fallback for buildBatonState when getBatonState absent. */
  window.getRouterLog = function () {
    return [
      { lane: 'fleet',   model: 'qwen2.5-coder:32b', tokens: 1820, cost: 0,    ts: Date.now() - 8000 },
      { lane: 'haiku',   model: 'claude-haiku-3',     tokens: 940,  cost: 0.01, ts: Date.now() - 5000 },
      { lane: 'premium', model: 'claude-sonnet-4',    tokens: 620,  cost: 0.04, ts: Date.now() - 2000 },
    ];
  };
})();
