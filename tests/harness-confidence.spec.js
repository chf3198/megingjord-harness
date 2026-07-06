'use strict';
// Tests for harness:confidence (#3631) — tdd-pyramid. Covers AC1-AC4 + deterministic derivation.
const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const {
  buildEnvelope, deriveOverall, checkEnvHydration, checkSkills, SCHEMA_VERSION, REQUIRED_KEYS,
} = require('../scripts/global/harness-confidence');

const SCHEMA = JSON.parse(fs.readFileSync(path.join(__dirname, 'fixtures/harness-confidence.schema.json'), 'utf8'));
const CHECK_NAMES = ['env_hydration', 'hamr', 'free_cloud_smoke', 'fleet_smoke', 'github', 'skills', 'tooling', 'deploy_parity'];

test('AC1: quick envelope carries schema_version and every required top-level + check key', async () => {
  const env = await buildEnvelope({ smoke: false });
  assert.equal(env.schema_version, 'harness-confidence/v1');
  assert.equal(env.schema_version, SCHEMA_VERSION);
  for (const key of ['schema_version', 'repo', 'runtime', 'overall', 'checks']) assert.ok(key in env, `missing ${key}`);
  for (const name of CHECK_NAMES) assert.ok(name in env.checks, `missing check ${name}`);
  // the committed schema fixture agrees on exactly these eight checks
  assert.deepEqual([...SCHEMA.properties.checks.required].sort(), [...CHECK_NAMES].sort());
  // overall.status is a valid enum value
  assert.ok(['pass', 'degraded', 'fail'].includes(env.overall.status));
});

test('AC1: --quick makes NO live provider/fleet calls (skipped with reason)', async () => {
  const env = await buildEnvelope({ smoke: false });
  assert.equal(env.checks.free_cloud_smoke.status, 'skipped');
  assert.equal(env.checks.free_cloud_smoke.reason, 'quick-mode');
  assert.equal(env.checks.fleet_smoke.status, 'skipped');
  assert.equal(env.runtime.execution_surface.network, null);
});

test('AC3: no secret values emitted — required_keys are present|missing only', async () => {
  const env = await buildEnvelope({ smoke: false });
  for (const value of Object.values(env.checks.env_hydration.required_keys)) {
    assert.ok(value === 'present' || value === 'missing', `leaked value: ${value}`);
  }
  const blob = JSON.stringify(env);
  for (const key of REQUIRED_KEYS) {
    const actual = process.env[key];
    if (actual && actual.length > 8) assert.ok(!blob.includes(actual), `secret value for ${key} leaked`);
  }
});

test('AC2: env_hydration fails from a keyless dir and passes with keys present', () => {
  const saved = {};
  for (const key of REQUIRED_KEYS) { saved[key] = process.env[key]; delete process.env[key]; }
  try {
    const keyless = fs.mkdtempSync(path.join(os.tmpdir(), 'hc-keyless-'));
    const failed = checkEnvHydration(keyless);
    assert.equal(failed.status, 'fail');
    assert.equal(failed.source, 'none');
    assert.equal(failed.env_file_present, false);
    for (const key of REQUIRED_KEYS) assert.equal(failed.required_keys[key], 'missing');

    const hydrated = fs.mkdtempSync(path.join(os.tmpdir(), 'hc-hydrated-'));
    fs.writeFileSync(path.join(hydrated, '.env'), `${REQUIRED_KEYS.map((k) => `${k}=xx-fake-not-a-real-secret`).join('\n')}\n`);
    const passed = checkEnvHydration(hydrated);
    assert.equal(passed.status, 'pass');
    assert.equal(passed.source, '.env');
    for (const key of REQUIRED_KEYS) assert.equal(passed.required_keys[key], 'present');
  } finally {
    for (const key of REQUIRED_KEYS) if (saved[key] !== undefined) process.env[key] = saved[key];
  }
});

test('skills: required availability resolves the NAMED skill, not "any registry has entries"', () => {
  const savedHome = process.env.HOME;
  try {
    const home = fs.mkdtempSync(path.join(os.tmpdir(), 'hc-home-'));
    // registry has entries + the named operator-identity-context, but NOT cross-family-review
    const reg = path.join(home, '.agents/skills/operator-identity-context');
    fs.mkdirSync(reg, { recursive: true });
    fs.writeFileSync(path.join(reg, 'SKILL.md'), '# skill');
    fs.mkdirSync(path.join(home, '.agents/skills/some-other-skill'), { recursive: true });
    process.env.HOME = home;
    const result = checkSkills();
    assert.equal(result.registry_available, true);
    assert.equal(result.required_skills['operator-identity-context'], 'available');
    assert.equal(result.required_skills['cross-family-review'], 'missing'); // not falsely inferred
    assert.equal(result.status, 'fail'); // a missing required skill fails, not a broad pass
  } finally { process.env.HOME = savedHome; }
});

test('AC4 + derivation: deterministic overall; deploy_parity degraded is a warning, blocking only on rollout', () => {
  const allPass = Object.fromEntries(CHECK_NAMES.map((n) => [n, { status: 'pass' }]));
  assert.deepEqual(deriveOverall(allPass, false), { status: 'pass', blocking: [], warnings: [] });

  const parityDegraded = { ...allPass, deploy_parity: { status: 'degraded' } };
  assert.deepEqual(deriveOverall(parityDegraded, false), { status: 'degraded', blocking: [], warnings: ['deploy_parity'] });
  assert.deepEqual(deriveOverall(parityDegraded, true), { status: 'fail', blocking: ['deploy_parity'], warnings: [] });

  const githubFailed = { ...allPass, github: { status: 'fail' } };
  const derived = deriveOverall(githubFailed, false);
  assert.equal(derived.status, 'fail');
  assert.ok(derived.blocking.includes('github'));

  // determinism: identical input yields identical output
  assert.deepEqual(deriveOverall(parityDegraded, false), deriveOverall(parityDegraded, false));
});
