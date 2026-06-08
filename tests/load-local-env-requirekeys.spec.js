// #2769 — requireKeys fail-closed + visibility + perf, on the canonical hydration shim.
const { test, expect } = require('@playwright/test');
const { execFileSync } = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { requireKeys, CredentialAbsentError } = require('../scripts/global/load-local-env');

function freshEnvProbe(envContents, readVar, extraEnv = {}) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'rk-'));
  const envFile = path.join(dir, '.env');
  fs.writeFileSync(envFile, envContents);
  const shim = path.resolve(__dirname, '..', 'scripts/global/load-local-env.js');
  return execFileSync(process.execPath, ['-e',
    `require(${JSON.stringify(shim)}).loadLocalEnvOnce(); process.stdout.write(String(process.env.${readVar}))`],
  { env: { MEGINGJORD_DOTENV_PATH: envFile, PATH: process.env.PATH, ...extraEnv }, encoding: 'utf8' });
}

test('requireKeys: a present key passes (ok, no absent)', () => {
  process.env.__RK_PRESENT = 'v';
  expect(requireKeys('__RK_PRESENT')).toEqual({ ok: true, absent: [] });
});

test('requireKeys: absent + throwOnAbsent:false reports without throwing (optional degrade)', () => {
  const r = requireKeys('__RK_OPTIONAL_ABSENT', { throwOnAbsent: false });
  expect(r.ok).toBe(false);
  expect(r.absent).toEqual(['__RK_OPTIONAL_ABSENT']);
});

test('requireKeys: an absent REQUIRED key throws a typed fail-closed error, never prompts', () => {
  let err;
  try { requireKeys('__RK_REQUIRED_ABSENT'); } catch (e) { err = e; }
  expect(err instanceof CredentialAbsentError).toBe(true);
  expect(err.code).toBe('CREDENTIAL_ABSENT');
  expect(err.absent).toEqual(['__RK_REQUIRED_ABSENT']);
  expect(err.message).toMatch(/never prompt the client/);
});

test('requireKeys: an empty-string value counts as absent (fail-closed)', () => {
  process.env.__RK_EMPTY = '';
  expect(requireKeys('__RK_EMPTY', { throwOnAbsent: false }).ok).toBe(false);
});

test('integration: a fresh child process with EMPTY env resolves keys from .env (visible-where-intended)', () => {
  expect(freshEnvProbe('RK_FROM_DOTENV=hello123\n', 'RK_FROM_DOTENV')).toBe('hello123');
});

test('integration: absent-where-not — a key NOT in .env stays undefined after hydration', () => {
  expect(freshEnvProbe('RK_ONLY=1\n', 'RK_NEVER_DECLARED')).toBe('undefined');
});

test('integration: fill-don\'t-override — a real env value wins over .env', () => {
  expect(freshEnvProbe('RK_OVERRIDE=from_dotenv\n', 'RK_OVERRIDE', { RK_OVERRIDE: 'from_real_env' }))
    .toBe('from_real_env');
});

test('perf: one-shot hydration is well under the 10ms startup budget (#2769 AC6)', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'rk-'));
  const envFile = path.join(dir, '.env');
  fs.writeFileSync(envFile, Array.from({ length: 50 }, (_, i) => `RK_PERF_${i}=v${i}`).join('\n') + '\n');
  delete require.cache[require.resolve('../scripts/global/load-local-env')];
  const mod = require('../scripts/global/load-local-env');
  const start = process.hrtime.bigint();
  mod.loadLocalEnv({ path: envFile, env: {}, quiet: true });
  const ms = Number(process.hrtime.bigint() - start) / 1e6;
  expect(ms, `hydration took ${ms.toFixed(2)}ms, budget is <10ms`).toBeLessThan(10);
});
