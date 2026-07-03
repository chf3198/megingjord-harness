'use strict';
// Tests for the F1 close-eligible detector (#3519, Epic #3517 / ADR-020 §D1).
// Covers eligibility, fail-closed detection, 2-sweep circuit-breaker, debounce/auto-clear,
// and the #3350 non-bypass regression (the signal can never close an epic).

const assert = require('node:assert/strict');
const { test } = require('node:test');
const {
  decideCloseEligible, isChildTerminal, SIGNAL_LABEL, PENDING_MARKER,
} = require('../scripts/global/epic-close-eligible.js');

const base = { childCount: 2, terminalCount: 2, restTerminalCount: 2, labelPresent: false, prevSweepEligible: true };

test('isChildTerminal: CLOSED or status:done/cancelled are terminal; open is not', () => {
  assert.equal(isChildTerminal({ state: 'CLOSED' }), true);
  assert.equal(isChildTerminal({ state: 'OPEN', labels: ['status:done'] }), true);
  assert.equal(isChildTerminal({ state: 'open', labels: [{ name: 'status:cancelled' }] }), true);
  assert.equal(isChildTerminal({ state: 'OPEN', labels: ['status:in-progress'] }), false);
});

test('eligible + 2nd consecutive sweep -> apply signal (not close)', () => {
  const r = decideCloseEligible(base);
  assert.equal(r.action, 'apply');
  assert.equal(r.label, SIGNAL_LABEL);
});

test('circuit-breaker: first eligible sweep -> pending (arm), no label yet', () => {
  const r = decideCloseEligible({ ...base, prevSweepEligible: false });
  assert.equal(r.action, 'pending');
  assert.equal(r.marker, PENDING_MARKER);
});

test('debounce: eligible + label already present -> debounce (no repeat)', () => {
  const r = decideCloseEligible({ ...base, labelPresent: true });
  assert.equal(r.action, 'debounce');
});

test('auto-clear: a child reopened (not all terminal) + label present -> clear', () => {
  const r = decideCloseEligible({ ...base, terminalCount: 1, restTerminalCount: 1, labelPresent: true });
  assert.equal(r.action, 'clear');
  assert.equal(r.clearPending, true);
});

test('not eligible + no label -> no-op', () => {
  const r = decideCloseEligible({ ...base, terminalCount: 1, restTerminalCount: 1 });
  assert.equal(r.action, 'no-op');
});

test('zero children -> not eligible (nothing delivered)', () => {
  const r = decideCloseEligible({ ...base, childCount: 0, terminalCount: 0, restTerminalCount: 0 });
  assert.equal(r.action, 'no-op');
});

test('fail-closed: unknown GraphQL child-count -> no-op + degraded incident (never apply)', () => {
  const r = decideCloseEligible({ ...base, childCount: null });
  assert.equal(r.action, 'no-op');
  assert.equal(r.degraded, true);
  assert.equal(r.incident, 'SUBISSUE_DETECT_DEGRADED');
});

test('fail-closed: REST cross-check errored (null) -> no-op degraded (the #3354 trap)', () => {
  const r = decideCloseEligible({ ...base, restTerminalCount: null });
  assert.equal(r.action, 'no-op');
  assert.equal(r.degraded, true);
});

test('fail-closed: GraphQL and REST disagree on terminal count -> no-op degraded', () => {
  const r = decideCloseEligible({ ...base, terminalCount: 2, restTerminalCount: 1 });
  assert.equal(r.action, 'no-op');
  assert.equal(r.degraded, true);
});

// --- #3350 non-bypass regression: the close-eligible signal is surface-only and can NEVER
// close an epic nor weaken the close-time veto. Assert over the full input space. ---
test('#3350 non-bypass: decideCloseEligible NEVER returns a close/reopen action', () => {
  const ALLOWED = new Set(['no-op', 'pending', 'apply', 'debounce', 'clear']);
  const bools = [true, false];
  const counts = [null, 0, 1, 2];
  let cases = 0;
  for (const childCount of counts)
    for (const terminalCount of [0, 1, 2])
      for (const restTerminalCount of counts)
        for (const labelPresent of bools)
          for (const prevSweepEligible of bools) {
            const r = decideCloseEligible({ childCount, terminalCount, restTerminalCount, labelPresent, prevSweepEligible });
            cases++;
            assert.ok(ALLOWED.has(r.action), `unexpected action ${r.action}`);
            assert.notEqual(r.close, true);
            assert.equal(r.closesEpic, undefined);
            // The signal must never assert terminal-child truth that would satisfy the #3350 veto path.
            if (r.action === 'apply') assert.equal(r.label, SIGNAL_LABEL);
          }
  assert.ok(cases > 100);
});

test('#3350 non-bypass: detector does not import or mutate epic-close-readiness', () => {
  const src = require('node:fs').readFileSync(require('node:path')
    .resolve(__dirname, '..', 'scripts', 'global', 'epic-close-eligible.js'), 'utf8');
  assert.equal(/epic-close-readiness|epic-close-validator|issues\.update\(.*state.*closed/i.test(src), false);
});
