'use strict';

// #3266: JS harness that executes the Python hook regression tests for the research-lane
// carve-out + honest code_touched. The behaviour lives in `hooks/scripts/*.py`; this spec is
// the cross-runtime test surface that runs the pytest/unittest modules and asserts they pass,
// so the JS test suite (and the tdd-spec discoverability gate) sees the coverage too.

const test = require('node:test');
const assert = require('node:assert/strict');
const { spawnSync } = require('node:child_process');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..');
const PY_MODULES = [
  'tests/hooks/test_pretool_guard_research_lane.py',
  'tests/hooks/test_stop_research_lane_exempt.py',
  'tests/hooks/test_tool_activity_nonrepo_3266.py',
];

for (const mod of PY_MODULES) {
  test(`python regression: ${mod}`, () => {
    const r = spawnSync('python3', [mod], { cwd: ROOT, encoding: 'utf8' });
    // A missing python3 interpreter is an environment gap, not a code failure — skip rather
    // than red the JS suite (the Python gate `governance:hooks:test` is the authority).
    if (r.error && r.error.code === 'ENOENT') {
      test.skip(`python3 unavailable — skipping ${mod}`);
      return;
    }
    assert.equal(r.status, 0,
      `${mod} must pass.\nstdout:\n${r.stdout}\nstderr:\n${r.stderr}`);
  });
}
