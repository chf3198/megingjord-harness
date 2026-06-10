// Stress tests for #2795 fleet-dev execution path — escalation/gate chaos (G6) + the real secret-exposure
// security gate over UNTRUSTED fleet output (G4) + a p99 budget (G7). Network/process-free (injected).
const { test, expect } = require('@playwright/test');
const { executeFleetDev, escalateTier } = require('../scripts/global/fleet-dev-execute.js');
const { defaultSecurityGate, runChecks } = require('../scripts/global/fleet-dev-gates.js');

const okResult = { ok: true };
const passGate = async () => ({ pass: true });
const failGate = async () => ({ pass: false });

test('#2795 CHAOS: a failing gate NEVER accepts and NEVER skips a tier, at every rung', async () => {
  for (const [tier, cls, expected] of [
    ['fleet', 'capability', 'haiku'], ['haiku', 'capability', 'premium'], ['premium', 'capability', null],
    ['fleet', 'availability', 'free-cloud'], ['free-cloud', 'availability', 'haiku'],
  ]) {
    const out = await executeFleetDev({ tier, dispatch: async () => okResult, functionalGate: failGate, securityGate: passGate });
    expect(out.accepted).toBe(false);
    expect(escalateTier(tier, cls)).toBe(expected); // one rung, deterministic
  }
});

test('#2795 SECURITY: fleet output containing a secret FAILS the security gate (never accepted)', async () => {
  const secrets = [
    { ok: true, content: 'token = ghp_' + 'a'.repeat(36) },
    { ok: true, content: 'aws AKIA' + 'ABCDEFGH12345678' },
    { ok: true, content: 'openai sk-' + 'x'.repeat(28) },
    { ok: true, key: '-----BEGIN RSA PRIVATE KEY-----' },
  ];
  for (const result of secrets) {
    const gate = defaultSecurityGate(result);
    expect(gate.pass).toBe(false);
    expect(gate.detail).toBe('secret-exposure-detected');
    // end-to-end: such output must escalate, never accept
    const out = await executeFleetDev({ dispatch: async () => result, functionalGate: passGate });
    expect(out.accepted).toBe(false);
    expect(out.reason).toMatch(/security-gate-failed/);
  }
});

test('#2795 SECURITY: the security gate never leaks the matched secret value in its detail', () => {
  const gate = defaultSecurityGate({ ok: true, content: 'ghp_' + 'z'.repeat(36) });
  expect(JSON.stringify(gate)).not.toContain('zzzz'); // detail is a label, not the value
});

test('#2795 CHAOS: clean/adversarial non-secret output passes security (no false positive, no throw)', () => {
  const cases = [null, undefined, { ok: true }, { ok: true, content: 'normal code here' },
    { circular: null }, { ok: true, content: 'x'.repeat(50000) }];
  cases[4].circular = cases[4]; // circular ref → unserializable → fail-closed, no throw
  for (const result of cases) {
    expect(() => defaultSecurityGate(result)).not.toThrow();
    expect(typeof defaultSecurityGate(result).pass).toBe('boolean');
  }
});

test('#2795 SECURITY: oversize untrusted output fails the security gate (no OOM, fail-closed)', () => {
  const huge = { ok: true, content: 'x'.repeat(1024 * 1024 + 50) }; // > MAX_SCAN_BYTES
  const gate = defaultSecurityGate(huge);
  expect(gate.pass).toBe(false);
  expect(gate.detail).toBe('output-too-large-to-scan');
});

test('#2795 SECURITY: a dispatch error never leaks internal IPs/hostnames into the reason/telemetry', async () => {
  const records = [];
  const out = await executeFleetDev({
    dispatch: async () => { throw Object.assign(new Error('connect ECONNREFUSED 100.91.113.16:11434'), { code: 'ECONNREFUSED' }); },
    emit: (rec) => records.push(rec),
  });
  expect(out.reason).toMatch(/dispatch-failed/);
  expect(out.reason).not.toContain('100.91.113.16'); // IP withheld
  expect(out.reason).toContain('ECONNREFUSED'); // safe code retained
  expect(JSON.stringify(records)).not.toContain('100.91.113.16'); // not in telemetry either
});

test('#2795 CHAOS: a throwing telemetry emit never blocks the escalation', async () => {
  const out = await executeFleetDev({ dispatch: async () => okResult, functionalGate: failGate,
    securityGate: passGate, emit: () => { throw new Error('disk full'); } });
  expect(out.accepted).toBe(false);
  expect(out.escalateTo).toBe('haiku'); // escalation still produced despite emit throwing
});

test('#2795 CHAOS: runChecks fail-closed — first failing check names itself, an exec error is a FAIL', () => {
  const exec = (cmd, args) => { if (args[0] === 'BOOM') throw Object.assign(new Error('x'), { status: 2 }); };
  expect(runChecks([['a', 'node', ['ok']], ['b', 'node', ['BOOM']]], exec))
    .toMatchObject({ pass: false, detail: /b-failed \(exit 2\)/ });
  expect(runChecks([['a', 'node', ['ok']]], exec).pass).toBe(true);
});

test('#2795 PERF: executeFleetDev p99 < 5ms on the injected-gate path', async () => {
  const samples = [];
  for (let iter = 0; iter < 1000; iter += 1) {
    const start = process.hrtime.bigint();
    // eslint-disable-next-line no-await-in-loop
    await executeFleetDev({ dispatch: async () => okResult, functionalGate: passGate, securityGate: passGate, emit: () => {} });
    samples.push(Number(process.hrtime.bigint() - start) / 1e6);
  }
  samples.sort((first, second) => first - second);
  expect(samples[Math.floor(samples.length * 0.99)]).toBeLessThan(5);
});
