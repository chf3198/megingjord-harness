/* transport-mocks-extended.js — additional IS_DEMO mocks; loaded after transport-mocks.js */
if (window.IS_DEMO) (function () {
  'use strict';
  const DEMO_TICKET  = 2809;
  const DEMO_PREV    = DEMO_TICKET - 1;
  const MS_14S       = 14000;
  const MS_9S        = 9000;
  const MS_4_5S      = 4500;
  const MS_8S        = 8000;
  const MS_5S        = 5000;
  const MS_2S        = 2000;
  const TOK_FLEET    = 1820;
  const TOK_HAIKU    = 940;
  const TOK_PREMIUM  = 620;
  const COST_HAIKU   = 0.01;
  const COST_PREMIUM = 0.04;

  /* getBatonState — honours _demoFixtureBatonState set by fixture-runner so
   * scenario replay controls baton without the refresh loop overwriting it. */
  window.getBatonState = function () {
    if (window._demoFixtureBatonState && window._demoFixtureBatonState.length) {
      return window._demoFixtureBatonState;
    }
    return [
      { role: 'manager',      issue: DEMO_TICKET, message: 'Scoping ACs + gates',  ts: Date.now() - MS_14S },
      { role: 'collaborator', issue: DEMO_TICKET, message: 'Implementation active', ts: Date.now() - MS_9S },
      { role: 'admin',        issue: DEMO_TICKET, message: 'CI gates running',      ts: Date.now() - MS_4_5S },
    ];
  };

  /* getTicketLog — synchronous; returns demo ticket entries. */
  window.getTicketLog = function () {
    return [
      { id: DEMO_TICKET, title: 'Demo Mode Quality Sprint', status: 'in-progress', role: 'collaborator' },
      { id: DEMO_PREV,   title: 'Fix demo device IDs',      status: 'done',         role: null },
    ];
  };

  /* loadWikiPages — async; returns demo wiki page stubs. */
  window.loadWikiPages = async function () {
    return [
      { title: 'Harness Goals',      path: 'wiki/wisdom/global/concepts/harness-goal-controls.md', fresh: true },
      { title: 'Role Baton Routing', path: 'wiki/wisdom/global/concepts/role-baton-routing.md',    fresh: true },
      { title: 'Demo Mode Overview', path: 'wiki/wisdom/global/concepts/demo-mode.md',              fresh: true },
    ];
  };

  /* getRouterLog — synchronous; fallback for buildBatonState when getBatonState absent. */
  window.getRouterLog = function () {
    return [
      { lane: 'fleet',   model: 'qwen2.5-coder:32b', tokens: TOK_FLEET,   cost: 0,           ts: Date.now() - MS_8S },
      { lane: 'haiku',   model: 'claude-haiku-3',     tokens: TOK_HAIKU,   cost: COST_HAIKU,  ts: Date.now() - MS_5S },
      { lane: 'premium', model: 'claude-sonnet-4',    tokens: TOK_PREMIUM, cost: COST_PREMIUM, ts: Date.now() - MS_2S },
    ];
  };
})();
