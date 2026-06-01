'use strict';

const test = require('node:test');
const assert = require('node:assert');
const { spawnSync } = require('node:child_process');

function runPython(code) {
  const r = spawnSync('python3', ['-c', code], { encoding: 'utf8' });
  assert.strictEqual(r.status, 0, r.stderr || 'python failed');
  return (r.stdout || '').trim();
}

test('guard detects client arbitration leakage for internal conflict text', () => {
  const out = runPython([
    'import sys, json',
    "sys.path.insert(0, 'hooks/scripts')",
    'import client_arbitration_guard as g',
    "print(json.dumps(g.detect_client_arbitration('worktree conflict: how would you like me to proceed?')))"
  ].join(';'));
  assert.match(out, /delegated-internal-conflict-decision-to-client/);
});

test('guard allows design-direction prompts', () => {
  const out = runPython([
    'import sys, json',
    "sys.path.insert(0, 'hooks/scripts')",
    'import client_arbitration_guard as g',
    "print(json.dumps(g.detect_client_arbitration('Design direction: which color palette should we use?')))"
  ].join(';'));
  assert.strictEqual(out, '[]');
});
