// Refs #2236 — JS spec verifying py block module + pretool_guard wiring + parity.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const PY_BLOCK = path.join(__dirname, '..', 'hooks', 'scripts', 'hamr_fleet_direct_block.py');
const PRETOOL_GUARD = path.join(__dirname, '..', 'hooks', 'scripts', 'pretool_guard.py');

test('Python block module exists at canonical path', () => {
  assert.ok(fs.existsSync(PY_BLOCK));
});

test('pretool_guard.py imports should_block + block_message (#2236 wiring)', () => {
  const src = fs.readFileSync(PRETOOL_GUARD, 'utf8');
  assert.match(src, /from hamr_fleet_direct_block import should_block, block_message/);
});

test('pretool_guard.py invokes should_block AND emits deny on block:True', () => {
  const src = fs.readFileSync(PRETOOL_GUARD, 'utf8');
  assert.match(src, /should_block\(_det\)/);
  assert.match(src, /emit\("deny", block_message/);
});

test('block module executable: env=1 + fleet-bypass = block', () => {
  const result = spawnSync('python3', ['-c', `
import sys, os
sys.path.insert(0, '${path.dirname(PY_BLOCK)}')
os.environ['MEGINGJORD_FLEET_DIRECT_BLOCK'] = '1'
from hamr_fleet_direct_block import should_block
r = should_block({'detected': True, 'severity': 'fleet-bypass'})
print(r['block'], r.get('reason'))
`], { encoding: 'utf8' });
  assert.equal(result.status, 0);
  assert.match(result.stdout, /True fleet-direct-blocked/);
});

test('block module executable: env=0 = no block', () => {
  const result = spawnSync('python3', ['-c', `
import sys
sys.path.insert(0, '${path.dirname(PY_BLOCK)}')
from hamr_fleet_direct_block import should_block
r = should_block({'detected': True, 'severity': 'fleet-bypass'}, env={})
print(r['block'], r['reason'])
`], { encoding: 'utf8' });
  assert.equal(result.status, 0);
  assert.match(result.stdout, /False env-flag-off/);
});

test('JS-Python parity: ENV_FLAG names match', () => {
  const js = require('../scripts/global/hamr-fleet-direct-block.js');
  const result = spawnSync('python3', ['-c', `
import sys
sys.path.insert(0, '${path.dirname(PY_BLOCK)}')
from hamr_fleet_direct_block import ENV_FLAG
print(ENV_FLAG)
`], { encoding: 'utf8' });
  assert.equal(result.status, 0);
  assert.equal(result.stdout.trim(), js.ENV_FLAG);
});
