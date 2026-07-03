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
      { activeRole: 'collaborator', issue: DEMO_TICKET, status: 'in-progress', title: 'Demo Mode Quality Sprint', agent: 'copilot', model: 'claude-sonnet-4' },
    ];
  };

  /* getTicketLog — synchronous; returns demo ticket entries. */
  window.getTicketLog = function () {
    if (window.demoConfig && window.demoConfig.ticketLog && window.demoConfig.ticketLog.length) return window.demoConfig.ticketLog;
    return [
      { issue: DEMO_TICKET, title: 'Demo Mode Quality Sprint', status: 'in-progress', activeRole: 'collaborator' },
      { issue: DEMO_PREV,   title: 'Fix demo device IDs',      status: 'done',        activeRole: null },
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

  /* fetchCoordinationState — cross-team coordination (refs ticket) */
  const COORD_CC_TICKET = 3037;
  const COORD_CC_PR = 3038;
  const COORD_AG_TICKET = 2800;
  const COORD_CODEX_PR = 2813;
  const MS_35MIN = 35 * 60000;
  window.fetchCoordinationState = async function () {
    const now = Date.now();
    return [
      { team: 'copilot', ticket: DEMO_TICKET, branch: 'feat/' + DEMO_TICKET + '-dashboard-demo', batonRole: 'collaborator', claimStatus: 'active', prNumber: null, files: ['dashboard/js/transport.js', 'dashboard/js/fixture-runner.js'], updatedMs: now - MS_2S },
      { team: 'codex', ticket: DEMO_PREV, branch: 'feat/' + DEMO_PREV + '-scenario-jsonl', batonRole: 'admin', claimStatus: 'active', prNumber: COORD_CODEX_PR, files: ['dashboard/fixtures/meta.json'], updatedMs: now - MS_5S },
      { team: 'claude-code', ticket: COORD_CC_TICKET, branch: 'feat/' + COORD_CC_TICKET + '-logging-attribution', batonRole: 'consultant', claimStatus: 'active', prNumber: COORD_CC_PR, files: ['scripts/global/agent-signature.js'], updatedMs: now - MS_8S },
      { team: 'antigravity', ticket: COORD_AG_TICKET, branch: 'fix/' + COORD_AG_TICKET + '-fleet-observability', batonRole: null, claimStatus: 'expired', prNumber: null, files: ['dashboard/js/transport.js'], updatedMs: now - MS_35MIN, state: 'expired' },
    ];
  };

  /* getRouterLog — synchronous; fallback for buildBatonState when getBatonState absent. */
  window.getRouterLog = function () {
    if (window.demoConfig && window.demoConfig.routerLog && window.demoConfig.routerLog.length) return window.demoConfig.routerLog;
    const now = new Date();
    return [
      { time: new Date(now - MS_8S).toLocaleTimeString(), agent: 'fleet-direct', model: 'qwen2.5-coder:32b', task: 'code review: baton-flow.js' },
      { time: new Date(now - MS_5S).toLocaleTimeString(), agent: 'haiku-escalate', model: 'claude-haiku-3', task: '4-tool chain: refactor transport' },
      { time: new Date(now - MS_2S).toLocaleTimeString(), agent: 'premium', model: 'claude-sonnet-4', task: 'complex analysis: architecture' },
    ];
  };
})();
