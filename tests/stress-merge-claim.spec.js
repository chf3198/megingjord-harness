const test = require('node:test');
const assert = require('node:assert');
const { spawnSync } = require('node:child_process');
const path = require('node:path');

const HOOKS = path.resolve(__dirname, '..', 'hooks', 'scripts');

function runClient(action, args, env = {}) {
  const script = `
import sys, json
sys.path.insert(0, "${HOOKS}")
import merge_claim_client as mcc
result = mcc.${action}(${args})
print(json.dumps(result))
`;
  const start = Date.now();
  const proc = spawnSync('python3', ['-c', script], {
    env: { ...process.env, ...env },
    encoding: 'utf8',
  });
  return { duration: Date.now() - start, stdout: proc.stdout, status: proc.status };
}

test('stress: 4 teams competing — sentinel fast-path when feature off, no contention', () => {
  const teams = ['claude-code', 'codex', 'copilot', 'antigravity'];
  const durations = [];
  for (const team of teams) {
    for (let i = 0; i < 25; i++) {
      const result = runClient('acquire', '2458', { MEGINGJORD_MERGE_CLAIM: '', HAMR_TEAM: team });
      durations.push(result.duration);
      assert.strictEqual(result.status, 0);
      const payload = JSON.parse(result.stdout.trim());
      assert.strictEqual(payload.claim_id, 'feature-off');
    }
  }
  durations.sort((a, b) => a - b);
  const p99 = durations[Math.floor(durations.length * 0.99)];
  assert.ok(p99 < 300, `sentinel-path p99 ${p99}ms exceeds 300ms budget`);
});

test('chaos: status query when feature off returns feature_off sentinel for all teams', () => {
  const teams = ['claude-code', 'codex', 'copilot', 'antigravity'];
  for (const team of teams) {
    const result = runClient('status', '2458', { MEGINGJORD_MERGE_CLAIM: '', HAMR_TEAM: team });
    assert.strictEqual(result.status, 0);
    const payload = JSON.parse(result.stdout.trim());
    assert.strictEqual(payload.held, false);
    assert.strictEqual(payload.feature_off, true);
  }
});
