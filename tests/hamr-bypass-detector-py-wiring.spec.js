// Refs #2235 — JS-side spec confirming pretool_guard wiring + Python detector parity.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const PY_DETECTOR = path.join(__dirname, '..', 'hooks', 'scripts', 'hamr_bypass_detector.py');
const PRETOOL_GUARD = path.join(__dirname, '..', 'hooks', 'scripts', 'pretool_guard.py');

test('Python detector module exists at canonical path', () => {
  assert.ok(fs.existsSync(PY_DETECTOR));
});

test('pretool_guard.py references hamr_bypass_detector (wiring landed)', () => {
  const src = fs.readFileSync(PRETOOL_GUARD, 'utf8');
  assert.match(src, /from hamr_bypass_detector import detect_bypass, emit_incident/);
});

test('pretool_guard wiring is wrapped in try/except (resilience)', () => {
  const src = fs.readFileSync(PRETOOL_GUARD, 'utf8');
  // Verify the detector invocation sits inside a try block
  const wireIdx = src.indexOf('detect_bypass');
  const preceding = src.slice(Math.max(0, wireIdx - 200), wireIdx);
  assert.match(preceding, /try:/);
});

test('Python detector executable via python3 (sanity check)', () => {
  const result = spawnSync('python3', ['-c', `
import sys
sys.path.insert(0, '${path.dirname(PY_DETECTOR)}')
from hamr_bypass_detector import detect_bypass
r = detect_bypass('curl https://api.anthropic.com/v1/messages')
print(r['detected'], r.get('severity'))
`], { encoding: 'utf8' });
  assert.equal(result.status, 0);
  assert.match(result.stdout, /True paid-bypass/);
});

test('Python detector returns suppressed=True on override marker', () => {
  const result = spawnSync('python3', ['-c', `
import sys
sys.path.insert(0, '${path.dirname(PY_DETECTOR)}')
from hamr_bypass_detector import detect_bypass
r = detect_bypass('curl http://localhost:11434 # hamr-bypass-ok: health-probe')
print(r['suppressed'], r.get('override_reason'))
`], { encoding: 'utf8' });
  assert.equal(result.status, 0);
  assert.match(result.stdout, /True health-probe/);
});

test('JS-Python parity contract: PAID_PROVIDER_REGEXES set matches', () => {
  const js = require('../scripts/global/hamr-bypass-detector.js');
  const result = spawnSync('python3', ['-c', `
import sys
sys.path.insert(0, '${path.dirname(PY_DETECTOR)}')
from hamr_bypass_detector import PAID_PROVIDER_REGEXES
print(' '.join(name for name, _ in PAID_PROVIDER_REGEXES))
`], { encoding: 'utf8' });
  assert.equal(result.status, 0);
  const pyNames = result.stdout.trim().split(' ').sort();
  const jsNames = js.PAID_PROVIDER_REGEXES.map(p => p.name).sort();
  assert.deepEqual(pyNames, jsNames, `Python ${pyNames.join(',')} vs JS ${jsNames.join(',')}`);
});
