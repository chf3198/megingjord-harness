const test = require('node:test');
const assert = require('node:assert/strict');
const { OPENCLAW_HEALTH_PATH, buildChecks, run } = require('../scripts/global/openclaw-preflight.js');

// #2974: preflight must probe /health/readiness (proxy-ready), NOT the deep /health
// that times out on cold fleet model backends and yields a false FAIL.

test('AC1/AC3: openclaw check targets /health/readiness, not the deep /health', () => {
  const checks = buildChecks('http://100.78.22.13:4000');
  const oc = checks.find(c => c.key === 'openclaw');
  assert.ok(oc, 'openclaw check present');
  assert.match(oc.cmd, /\/health\/readiness$/, 'targets /health/readiness');
  assert.doesNotMatch(oc.cmd, /:4000\/health(\s|$)/, 'does NOT use the bare deep /health endpoint');
  assert.equal(OPENCLAW_HEALTH_PATH, '/health/readiness');
});

test('buildChecks keeps the tailscale check and bounds the curl timeout', () => {
  const checks = buildChecks('http://x:4000');
  assert.deepEqual(checks.map(c => c.key), ['tailscale', 'openclaw']);
  assert.match(checks[1].cmd, /curl -sf --max-time 5 http:\/\/x:4000\/health\/readiness/);
});

test('AC2: require-safe — importing the module does not run the CLI (no process.exit)', () => {
  // If require.main guard were missing, requiring above would have exited the test process.
  assert.equal(typeof buildChecks, 'function');
  assert.equal(typeof run, 'function');
});

test('run: dryRun returns ok without executing', () => {
  const r = run('curl -sf http://x:4000/health/readiness', { dryRun: true });
  assert.equal(r.ok, true);
  assert.match(r.out, /^DRY_RUN /);
});
