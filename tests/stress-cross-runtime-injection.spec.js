'use strict';
// Stress (#1936, Epic #1875 adversarial-input parser surface): ≥1 chaos/fault-injection path (G6)
// + a p99 budget (G7). Randomized forged inputs must be detected every time; auditAll stays fast.
const assert = require('node:assert/strict');
const { test } = require('node:test');
const guard = require('../scripts/global/cross-runtime-injection-guard');

test('stress G6 chaos: randomized untrusted teams are always detected', () => {
  for (let i = 0; i < 500; i++) {
    const out = guard.validateHookEnv({ HAMR_TEAM: `intruder-${i}` }, { knownTeams: ['claude-code', 'copilot'] });
    assert.equal(out.findings.some((f) => f.id === 'hook-env-team-untrusted'), true,
      `intruder team ${i} must be flagged`);
  }
});

test('stress G6 chaos: injected session payloads are always rejected', () => {
  const payloads = ['a;b', 'x y', '$(whoami)', '`id`', 'a\nb', 'p|q', 'a&&b', '../../etc'];
  for (let i = 0; i < 200; i++) {
    const payload = payloads[i % payloads.length] + i;
    const out = guard.validateHookEnv({ HAMR_TEAM: 'claude-code', MEGINGJORD_SESSION_ID: payload },
      { knownTeams: ['claude-code'] });
    assert.equal(out.findings.some((f) => f.id === 'hook-env-session-malformed'), true,
      `payload "${payload}" must be flagged`);
  }
});

test('stress G6 chaos: forged cross-team leases are always reconciled-out', () => {
  for (let i = 0; i < 300; i++) {
    const out = guard.reconcileLease([], [{ ticket: String(i), team: 'copilot', paths: [`p-${i}`] }]);
    assert.equal(out.ok, false, `forged lease ${i} must be flagged`);
  }
});

test('stress G7: auditAll p99 within 25ms budget', () => {
  const inputs = { env: { HAMR_TEAM: 'claude-code', MEGINGJORD_SESSION_ID: 'sess-1' },
    artifact: { team: 'claude-code', role: 'consultant', signedBy: 'Orla Vale' },
    localLeases: [], authoritativeLeases: [{ ticket: '1', team: 'copilot', paths: ['x'] }] };
  const opts = { knownTeams: ['claude-code'], prTeam: 'claude-code', resolveEnrolledAlias: () => 'Orla Vale' };
  const N = 500; const lat = [];
  for (let i = 0; i < N; i++) {
    const s = process.hrtime.bigint();
    guard.auditAll(inputs, opts);
    lat.push(Number(process.hrtime.bigint() - s) / 1e6);
  }
  lat.sort((a, b) => a - b);
  const p99 = lat[Math.max(0, Math.ceil(N * 0.99) - 1)];
  assert.ok(p99 < 25, `auditAll p99 ${p99.toFixed(3)}ms must be < 25ms`);
});
