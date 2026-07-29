'use strict';
// Close-atomicity gate (Epic #3576 W-C, E10). A completion claim must not be emitted
// until the close mutation has completed AND the tracker state, RE-READ, is terminal.
// Guards the #3529 "reported closed while OPEN + resolution:released" open-done race.
// Builds on the #3284 baton FSM terminal-state semantics (issue CLOSED + single terminal
// status label + no execution role + no open baton-back).
const TERMINAL_STATUS = 'status:done';
const CANCELLED_STATUS = 'status:cancelled';
const COMPLETION_CLAIM_RE = /\b(complete|completed|done|closed|shipped|finished)\b/i;

function isTerminal(state = {}) {
  const labels = Array.isArray(state.labels) ? state.labels : [];
  const status = labels.filter((l) => typeof l === 'string' && l.startsWith('status:'));
  const roles = labels.filter((l) => typeof l === 'string' && l.startsWith('role:'));
  const terminalStatus = status.length === 1
    && (status[0] === TERMINAL_STATUS || status[0] === CANCELLED_STATUS);
  return {
    ok: state.issueState === 'CLOSED' && terminalStatus && roles.length === 0 && !state.openBatonBack,
    issueClosed: state.issueState === 'CLOSED',
    terminalStatus,
    noRole: roles.length === 0,
    noOpenBatonBack: !state.openBatonBack,
  };
}

// If the claim asserts done/complete but the RE-READ state is not terminal, block it (E10).
function completionClaimGuard(claimText, state = {}) {
  if (!COMPLETION_CLAIM_RE.test(String(claimText || ''))) {
    return { ok: true, blocked: false, reason: 'no-completion-claim' };
  }
  const term = isTerminal(state);
  if (term.ok) return { ok: true, blocked: false, reason: 'terminal-verified' };
  return { ok: false, blocked: true, reason: 'open-done-race',
    detail: `completion claim emitted but re-read state is not terminal `
      + `(closed=${term.issueClosed}, terminalStatus=${term.terminalStatus}, `
      + `noRole=${term.noRole}, noOpenBatonBack=${term.noOpenBatonBack})` };
}

module.exports = { isTerminal, completionClaimGuard, TERMINAL_STATUS, CANCELLED_STATUS };
