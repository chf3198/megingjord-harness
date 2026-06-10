// Refs #2795 P1-2 of Epic #2791 — fleet-dev execution path. Network/process-free: dispatch + both gates
// + emit are injected.
const { test, expect } = require('@playwright/test');
process.env.MEGINGJORD_NO_TELEMETRY = '1'; // #2885: tests must never write prod telemetry
const {
  executeFleetDev, runObjectiveGate, escalateTier, safeGate,
} = require('../scripts/global/fleet-dev-execute.js');

const okResult = { ok: true, changes: [{ path: 'a.js', content: 'x' }] };
const passGate = async () => ({ pass: true });
const failGate = async () => ({ pass: false, detail: 'nope' });
const dispatchOk = async () => okResult;

test('#2795 AC1/AC2 both gates pass → accept (the G3 win)', async () => {
  const out = await executeFleetDev({ dispatch: dispatchOk, functionalGate: passGate, securityGate: passGate });
  expect(out.accepted).toBe(true);
  expect(out.tier).toBe('fleet');
  expect(out.reason).toBe('both-gates-pass');
});

test('#2795 AC2 a functional-gate failure escalates exactly one capability tier (fleet→haiku)', async () => {
  const out = await executeFleetDev({ dispatch: dispatchOk, functionalGate: failGate, securityGate: passGate });
  expect(out.accepted).toBe(false);
  expect(out.escalationClass).toBe('capability');
  expect(out.escalateTo).toBe('haiku'); // one tier, not premium
  expect(out.reason).toMatch(/functional-gate-failed/);
});

test('#2795 AC2 a security-gate failure escalates (capability), reason names security', async () => {
  const out = await executeFleetDev({ dispatch: dispatchOk, functionalGate: passGate, securityGate: failGate });
  expect(out.accepted).toBe(false);
  expect(out.reason).toMatch(/security-gate-failed/);
  expect(out.escalateTo).toBe('haiku');
});

test('#2795 AC2 escalateTier is one-tier-at-a-time and never silent-to-Premium', () => {
  expect(escalateTier('fleet', 'capability')).toBe('haiku');
  expect(escalateTier('haiku', 'capability')).toBe('premium');
  expect(escalateTier('premium', 'capability')).toBe(null); // top of ladder
  // availability: $0 free-cloud BEFORE paid (#2619)
  expect(escalateTier('fleet', 'availability')).toBe('free-cloud');
  expect(escalateTier('free-cloud', 'availability')).toBe('haiku');
});

test('#2795 AC2 fleet UNREACHABLE (dispatch throws) → availability escalation to free-cloud', async () => {
  const out = await executeFleetDev({ dispatch: async () => { throw new Error('ECONNREFUSED'); } });
  expect(out.accepted).toBe(false);
  expect(out.escalationClass).toBe('availability');
  expect(out.escalateTo).toBe('free-cloud'); // not haiku, not premium
  expect(out.reason).toMatch(/dispatch-failed/);
});

test('#2795 AC2 a not-ok dispatch result is an availability escalation', async () => {
  const out = await executeFleetDev({ dispatch: async () => ({ ok: false, reason: 'fleet-down' }) });
  expect(out.escalationClass).toBe('availability');
  expect(out.reason).toBe('fleet-down');
});

test('#2795 AC3 the escalation reason + tiers are recorded to telemetry (for the #2796 governor)', async () => {
  const records = [];
  await executeFleetDev({ dispatch: dispatchOk, functionalGate: failGate, securityGate: passGate,
    emit: (rec) => records.push(rec), now: () => 1700000000000 });
  expect(records).toHaveLength(1);
  expect(records[0]).toMatchObject({
    event: 'fleet-dev-escalation', from_tier: 'fleet', to_tier: 'haiku',
    escalation_class: 'capability', reason: 'functional-gate-failed', ts: 1700000000000,
  });
});

test('#2795 AC3 a DUAL gate failure is classified as "both" for the governor (not just one)', async () => {
  const out = await executeFleetDev({ dispatch: dispatchOk, functionalGate: failGate, securityGate: failGate });
  expect(out.accepted).toBe(false);
  expect(out.reason).toBe('both-gate-failed'); // accurate classification, not only functional
});

test('#2795 FAIL-CLOSED: a missing or throwing gate is a FAIL (escalate, never accept)', async () => {
  expect(await safeGate(undefined, okResult)).toMatchObject({ pass: false, detail: 'gate-not-configured' });
  expect(await safeGate(async () => { throw new Error('boom'); }, okResult))
    .toMatchObject({ pass: false });
  // a gate returning a non-pass shape never counts as pass
  expect((await safeGate(async () => ({ ok: 'maybe' }), okResult)).pass).toBe(false);
  const gate = await runObjectiveGate(okResult, { functionalGate: passGate, securityGate: async () => { throw new Error('x'); } });
  expect(gate.allPass).toBe(false); // a throwing gate → fail-closed (does not accept)
});

test('#2795 executeFleetDev requires a dispatch function', async () => {
  await expect(executeFleetDev({})).rejects.toThrow(/opts\.dispatch.*required/);
});
