const test = require('node:test');
const assert = require('node:assert');
const { spawnSync } = require('node:child_process');
const path = require('node:path');

const STRESS_ITERATIONS = 50;
const P99_BUDGET_MS = 200;
const HOOKS = path.resolve(__dirname, '..', 'hooks', 'scripts');

function runResolver(ticketN, env = {}) {
  const script = `
import sys
sys.path.insert(0, "${HOOKS}")
import github_role_resolver as resolver
result = resolver.derive_roles_from_github(${ticketN})
print(result if result else "None")
`;
  const start = Date.now();
  const proc = spawnSync('python3', ['-c', script], {
    env: { ...process.env, ...env },
    encoding: 'utf8',
  });
  return { duration: Date.now() - start, stdout: proc.stdout, status: proc.status };
}

test('stress: 50 sequential invocations all return null when feature off, p99 < 200ms', () => {
  const durations = [];
  for (let i = 0; i < STRESS_ITERATIONS; i++) {
    const result = runResolver(2456, { MEGINGJORD_DERIVE_ROLES_FROM_GH: '' });
    durations.push(result.duration);
    assert.strictEqual(result.status, 0);
    assert.match(result.stdout, /None/);
  }
  durations.sort((a, b) => a - b);
  const p99 = durations[Math.floor(durations.length * 0.99)];
  assert.ok(p99 < P99_BUDGET_MS, `p99 ${p99}ms exceeds budget ${P99_BUDGET_MS}ms`);
});

test('chaos: ticket extraction from various branch patterns', () => {
  const cases = [
    { branch: 'fix/2456-foo', expected: '2456' },
    { branch: 'feat/1234-bar', expected: '1234' },
    { branch: 'main', expected: 'None' },
    { branch: '', expected: 'None' },
  ];
  for (const { branch, expected } of cases) {
    const script = `
import sys
sys.path.insert(0, "${HOOKS}")
from stop_checks import ticket_from_branch
print(ticket_from_branch(${branch ? JSON.stringify(branch) : "None"}))
`;
    const proc = spawnSync('python3', ['-c', script], { encoding: 'utf8' });
    assert.strictEqual(proc.status, 0);
    if (expected === 'None') {
      assert.match(proc.stdout, /None/);
    } else {
      assert.match(proc.stdout, new RegExp(expected));
    }
  }
});

test('chaos: effective_roles falls back to state_roles when feature off', () => {
  const script = `
import sys
sys.path.insert(0, "${HOOKS}")
from stop_checks import effective_roles
state_roles = {"collaborator": True, "admin": False}
result = effective_roles(state_roles, "fix/2456-foo")
print(result == state_roles)
`;
  const proc = spawnSync('python3', ['-c', script], {
    env: { ...process.env, MEGINGJORD_DERIVE_ROLES_FROM_GH: '' },
    encoding: 'utf8',
  });
  assert.strictEqual(proc.status, 0);
  assert.match(proc.stdout, /True/);
});
