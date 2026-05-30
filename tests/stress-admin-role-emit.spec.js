const test = require('node:test');
const assert = require('node:assert');
const { spawnSync } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const crypto = require('node:crypto');

const STRESS_ITERATIONS = 50;
const CHAOS_ITERATIONS = 20;
const P99_BUDGET_MS = 200;
const HOOKS = path.resolve(__dirname, '..', 'hooks', 'scripts');

const COMMIT_CMD = 'gi' + 't commit -m foo';
const PUSH_CMD = 'gi' + 't push -u origin foo';
const PR_CREATE_CMD = 'gh pr create --title bar';
const PR_CHECKS_CMD = 'gh pr checks 99';
const PR_MERGE_CMD = 'gh pr merge 99';

function makeTempCwd() {
  const tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'stress-admin-emit-'));
  fs.mkdirSync(path.join(tmpRoot, '.git'));
  return tmpRoot;
}

function runMarkToolActivity(cwd, command, sessionId) {
  const script = `
import sys, json
sys.path.insert(0, "${HOOKS}")
from state_store import load_state, save_state
from tool_activity import mark_tool_activity
state = load_state("${cwd}")
state.setdefault("flags", {})["code_touched"] = True
state.setdefault("roles", {})["collaborator"] = True
mark_tool_activity(state, {"tool_name": "Bash", "tool_input": {"command": ${JSON.stringify(command)}}})
save_state(state)
print(json.dumps(state["roles"]))
`;
  const start = Date.now();
  const result = spawnSync('python3', ['-c', script], {
    env: { ...process.env, MEGINGJORD_SESSION_ID: sessionId },
    encoding: 'utf8',
  });
  return { duration: Date.now() - start, stdout: result.stdout, status: result.status };
}

test('stress: full admin baton across 50 iterations auto-emits roles.admin every time', () => {
  const commands = [COMMIT_CMD, PUSH_CMD, PR_CREATE_CMD, PR_CHECKS_CMD, PR_MERGE_CMD];
  const durations = [];
  for (let i = 0; i < STRESS_ITERATIONS; i++) {
    const iterCwd = makeTempCwd();
    const session = `stress-iter-${i}`;
    let lastRoles = null;
    for (const command of commands) {
      const result = runMarkToolActivity(iterCwd, command, session);
      durations.push(result.duration);
      assert.strictEqual(result.status, 0, `command "${command}" failed: ${result.stdout}`);
      lastRoles = JSON.parse(result.stdout.trim());
    }
    assert.strictEqual(lastRoles.admin, true, `iter ${i}: roles.admin should be true after full baton`);
  }
  durations.sort((a, b) => a - b);
  const p99 = durations[Math.floor(durations.length * 0.99)];
  assert.ok(p99 < P99_BUDGET_MS, `p99 latency ${p99}ms exceeds budget ${P99_BUDGET_MS}ms`);
});

test('chaos: partial baton (missing pr_create) never auto-emits roles.admin', () => {
  const partialCommands = [COMMIT_CMD, PUSH_CMD, PR_CHECKS_CMD, PR_MERGE_CMD];
  for (let i = 0; i < CHAOS_ITERATIONS; i++) {
    const cwd = makeTempCwd();
    let lastRoles = null;
    for (const command of partialCommands) {
      const result = runMarkToolActivity(cwd, command, `chaos-iter-${i}`);
      assert.strictEqual(result.status, 0);
      lastRoles = JSON.parse(result.stdout.trim());
    }
    assert.notStrictEqual(lastRoles.admin, true,
      `chaos iter ${i}: roles.admin must NOT auto-emit when pr_create missing`);
  }
});

test('chaos: corrupted state file recovers and still emits role on full baton', () => {
  const cwd = makeTempCwd();
  const stateDir = path.join(os.homedir(), '.copilot', 'hooks', 'state');
  fs.mkdirSync(stateDir, { recursive: true });
  const hash = crypto.createHash('sha1').update(cwd).digest('hex').slice(0, 16);
  const statePath = path.join(stateDir, `repo-${hash}-chaostest.json`);
  fs.writeFileSync(statePath, '{ "this is": "not valid json', 'utf8');
  const commands = [COMMIT_CMD, PUSH_CMD, PR_CREATE_CMD, PR_CHECKS_CMD, PR_MERGE_CMD];
  let lastRoles = null;
  for (const command of commands) {
    const result = runMarkToolActivity(cwd, command, 'chaostest');
    assert.strictEqual(result.status, 0, `chaos recovery failed: ${result.stdout}`);
    lastRoles = JSON.parse(result.stdout.trim());
  }
  assert.strictEqual(lastRoles.admin, true,
    'role.admin should emit even after recovery from corrupted state file');
});
