'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { execFileSync } = require('node:child_process');
const { writeFileSync, unlinkSync } = require('node:fs');
const { tmpdir } = require('node:os');
const { join } = require('node:path');

const SCRIPT = join(__dirname, '../scripts/global/baton-comment-build.js');
const TM = 'copilot:claude-sonnet-4-6@anthropic';

function run(args) {
  try {
    const stdout = execFileSync(process.execPath, [SCRIPT, ...args], {
      env: { ...process.env, TEAM_MODEL: TM },
      encoding: 'utf8',
    });
    return { code: 0, stdout, stderr: '' };
  } catch (e) {
    return { code: e.status || 1, stdout: e.stdout || '', stderr: e.stderr || '' };
  }
}

// T1: single unknown flag exits 1 with "unknown flag" in stderr
test('T1: unknown flag exits 1', () => {
  const r = run(['--artifact', 'COLLABORATOR_HANDOFF', '--unknown-flag', 'val',
    '--ticket', '1']);
  assert.equal(r.code, 1);
  assert.ok(r.stderr.includes('unknown flag'), `stderr: ${r.stderr}`);
});

// T2: multiple unknown flags — exits 1 for first unknown
test('T2: multiple unknown flags exits 1', () => {
  const r = run(['--artifact', 'MANAGER_HANDOFF', '--foo', 'bar', '--baz', 'qux',
    '--ticket', '1']);
  assert.equal(r.code, 1);
  assert.ok(r.stderr.includes('unknown flag'), `stderr: ${r.stderr}`);
});

// T3: MANAGER_HANDOFF legacy path without --summary exits 1 (missing required fields)
test('T3: MANAGER_HANDOFF legacy missing fields exits 1', () => {
  const r = run(['--artifact', 'MANAGER_HANDOFF', '--ticket', '1']);
  assert.equal(r.code, 1);
  assert.ok(r.stderr.includes('missing required field'), `stderr: ${r.stderr}`);
});

// T4: COLLABORATOR_HANDOFF legacy path without fields exits 0 (backward-compat)
test('T4: COLLABORATOR_HANDOFF legacy no fields exits 0', () => {
  const r = run(['--artifact', 'COLLABORATOR_HANDOFF', '--ticket', '1']);
  assert.equal(r.code, 0);
});

// T5: --fields-json with valid file exits 0 and output contains required fields
test('T5: --fields-json valid exits 0 with scope/lane in output', () => {
  const tmp = join(tmpdir(), `bcb-test-${Date.now()}.json`);
  const fields = {
    scope: 'test scope', lane: 'lane:code-change',
    test_strategy: 'tdd-pyramid', acceptance: 'ac', gates: 'lint',
    related_tickets: '#1', overlap_decision: 'none',
  };
  writeFileSync(tmp, JSON.stringify(fields));
  try {
    const r = run(['--artifact', 'MANAGER_HANDOFF', '--ticket', '99',
      '--fields-json', tmp]);
    assert.equal(r.code, 0);
    assert.ok(r.stdout.includes('scope:'), `stdout: ${r.stdout}`);
    assert.ok(r.stdout.includes('lane:'), `stdout: ${r.stdout}`);
  } finally {
    try { unlinkSync(tmp); } catch { /* best-effort cleanup */ }
  }
});

// T6: all recognized flags accepted, exits 0 (no false positives)
test('T6: all recognized flags exit 0', () => {
  const r = run(['--artifact', 'COLLABORATOR_HANDOFF', '--role', 'collaborator',
    '--ticket', '1', '--summary', 'test']);
  assert.equal(r.code, 0);
});
