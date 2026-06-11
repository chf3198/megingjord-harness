// #2918 — Structured decision pathway logging (baton_event_emitter G-19)
// Tests: emit_decision(), default-on flag, deny wiring, baton artifact detection
const { test, expect } = require('@playwright/test');
const { execFileSync } = require('child_process');
const path = require('path');

const REPO_ROOT = path.resolve(__dirname, '..');

function py(script) {
  return execFileSync('python3', ['-c', script], { cwd: REPO_ROOT, encoding: 'utf8' });
}

test('#2918: feature enabled by default (no env var required)', () => {
  const out = py(`
import sys, os
sys.path.insert(0, 'hooks/scripts')
os.environ.pop('MEGINGJORD_BATON_EVENT_LOG', None)
import baton_event_emitter as e
assert e.feature_enabled(), "feature_enabled() should be True by default"
print("OK")
`);
  expect(out.trim()).toBe('OK');
});

test('#2918: feature disabled by MEGINGJORD_BATON_EVENT_LOG=0', () => {
  const out = py(`
import sys, os
sys.path.insert(0, 'hooks/scripts')
os.environ['MEGINGJORD_BATON_EVENT_LOG'] = '0'
import importlib, baton_event_emitter as e
importlib.reload(e)
assert not e.feature_enabled(), "feature_enabled() should be False when =0"
print("OK")
`);
  expect(out.trim()).toBe('OK');
});

test('#2918: emit_decision() writes structured record to decisions.jsonl', () => {
  const out = py(`
import sys, json, os, tempfile
sys.path.insert(0, 'hooks/scripts')
import baton_event_emitter as e
tmp = tempfile.mktemp(suffix='.jsonl')
e.DECISIONS_LOG_PATH = __import__('pathlib').Path(tmp)
os.environ.pop('MEGINGJORD_BATON_EVENT_LOG', None)
ok = e.emit_decision('manager', 'manager.handoff', 'posted',
                     ticket=2918, input_summary='MANAGER_HANDOFF posted on #2918',
                     rationale='scope defined')
assert ok, "emit_decision should return True when enabled"
rec = json.loads(open(tmp).read().strip())
assert rec['event'] == 'governance.decision'
assert rec['role'] == 'manager'
assert rec['decision_type'] == 'manager.handoff'
assert rec['verdict'] == 'posted'
assert rec['ticket'] == 2918
assert 'ts' in rec and 'version' in rec
print("OK")
`);
  expect(out.trim()).toBe('OK');
});

test('#2918: emit_decision() redacts secrets in rationale', () => {
  const out = py(`
import sys, json, os, tempfile
sys.path.insert(0, 'hooks/scripts')
import baton_event_emitter as e
tmp = tempfile.mktemp(suffix='.jsonl')
e.DECISIONS_LOG_PATH = __import__('pathlib').Path(tmp)
os.environ.pop('MEGINGJORD_BATON_EVENT_LOG', None)
e.emit_decision('admin', 'tool-denied', 'denied', rationale='token ghp_AAABBBCCCDDDEEEFFFGGGHHHIIIJJJ leaked')
rec = json.loads(open(tmp).read().strip())
assert '[REDACTED:github-pat]' in rec['rationale'], f"Got: {rec['rationale']}"
print("OK")
`);
  expect(out.trim()).toBe('OK');
});

test('#2918: decisions.jsonl is append-only (multiple entries accumulate)', () => {
  const out = py(`
import sys, json, os, tempfile
sys.path.insert(0, 'hooks/scripts')
import baton_event_emitter as e
tmp = tempfile.mktemp(suffix='.jsonl')
e.DECISIONS_LOG_PATH = __import__('pathlib').Path(tmp)
os.environ.pop('MEGINGJORD_BATON_EVENT_LOG', None)
e.emit_decision('manager', 'manager.handoff', 'posted', ticket=1)
e.emit_decision('collaborator', 'collaborator.handoff', 'posted', ticket=1)
e.emit_decision('pretool-guard', 'tool-denied', 'denied', ticket=1)
lines = open(tmp).read().strip().split('\\n')
assert len(lines) == 3, f"Expected 3 entries, got {len(lines)}"
print("OK")
`);
  expect(out.trim()).toBe('OK');
});

test('#2918: baton_event_emitter tests pass', () => {
  try {
    execFileSync('python3', ['-m', 'unittest', 'tests.hooks.test_baton_event_emitter', '-v'],
      { cwd: REPO_ROOT, encoding: 'utf8', stdio: 'pipe' });
  } catch (e) {
    throw new Error(`unittest failed:\n${e.stdout}\n${e.stderr}`);
  }
});
