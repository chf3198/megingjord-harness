#!/usr/bin/env node
'use strict';
// #3173 — Regression tests: fleet setup API + wizard UI (node:test runner)
const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const { fleetSetupStatus, fleetInventoryPayload, OPTIONAL_KEYS } =
  require('../dashboard/api/fleet-setup-status');
const { ENV_NAME, writeEnvAtomic } =
  require('../scripts/global/harness-credential-write');
const { dispatchFleetSetup, readJsonBody, saveCredentials } =
  require('../dashboard/api/fleet-setup-actions');
const { handleFleetSetupApi } =
  require('../dashboard/api/fleet-setup-handlers');

// AC1: /api/fleet/setup/status route returns expected shape
describe('AC1: fleet setup status route', () => {
  it('returns ok:true with deviceCount and probeStale', () => {
    const status = fleetSetupStatus();
    assert.equal(status.ok, true, 'status.ok must be true');
    assert.equal(typeof status.deviceCount, 'number', 'deviceCount must be number');
    assert.equal(typeof status.probeStale, 'boolean', 'probeStale must be boolean');
    assert.ok(Array.isArray(status.missingOptionalKeys), 'missingOptionalKeys must be array');
  });

  it('OPTIONAL_KEYS list is non-empty and uppercase_underscore', () => {
    assert.ok(OPTIONAL_KEYS.length > 0, 'OPTIONAL_KEYS must not be empty');
    for (const k of OPTIONAL_KEYS) {
      assert.match(k, /^[A-Z0-9_]+$/, `key ${k} must be UPPER_SNAKE`);
    }
  });
});

// AC2: Credential POST uses server-side keychain/.env — never localStorage
describe('AC2: credential write uses server-side store', () => {
  it('writeEnvAtomic writes named key to .env file', () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), '3173-env-'));
    const envPath = path.join(dir, '.env');
    writeEnvAtomic(envPath, 'GROQ_API_KEY', 'test-value-3173');
    const text = fs.readFileSync(envPath, 'utf8');
    assert.ok(text.includes('GROQ_API_KEY=test-value-3173'), 'env file must contain key=value');
    fs.rmSync(dir, { recursive: true });
  });

  it('ENV_NAME regex accepts valid keys and rejects invalid', () => {
    assert.ok(ENV_NAME.test('OPENROUTER_API_KEY'), 'valid key must pass');
    assert.ok(ENV_NAME.test('GROQ_API_KEY'), 'valid key must pass');
    assert.ok(!ENV_NAME.test('bad-key'), 'hyphen key must fail');
    assert.ok(!ENV_NAME.test(''), 'empty string must fail');
  });
});

// AC3: fleet-settings.js stores no API keys in localStorage
describe('AC3: fleet-settings.js contains no API key localStorage writes', () => {
  it('fleet-settings.js source has no API key patterns', () => {
    const src = fs.readFileSync(
      path.join(__dirname, '../dashboard/js/fleet-settings.js'), 'utf8'
    );
    // Must NOT contain API_KEY form inputs or stored values
    assert.ok(!src.includes('API_KEY='), 'must not contain API_KEY= literal');
    assert.ok(!src.includes("type=\"password\""), 'must not contain password input');
    // Must contain the wizard delegation comment
    assert.ok(
      src.includes('credentials') || src.includes('wizard') || src.includes('#3173'),
      'must reference wizard/credentials/3173'
    );
  });

  it('credential-store.js stores resources (not secrets)', () => {
    const src = fs.readFileSync(
      path.join(__dirname, '../dashboard/js/credential-store.js'), 'utf8'
    );
    // credential-store stores fleet resource configs, not API secrets
    assert.ok(src.includes('devenv-fleet-resources'), 'must use fleet-resources key');
    assert.ok(!src.includes('GROQ_API_KEY'), 'must not hardcode API key names');
  });
});

// AC4: renderFleetSetupWizard function exists in wizard file
describe('AC4: fleet setup wizard UI exists and is wired', () => {
  it('fleet-setup-wizard.js exports required functions', () => {
    const src = fs.readFileSync(
      path.join(__dirname, '../dashboard/js/fleet-setup-wizard.js'), 'utf8'
    );
    assert.ok(src.includes('renderFleetSetupWizard'), 'renderFleetSetupWizard must exist');
    assert.ok(src.includes('registerFleetSetupPanel'), 'registerFleetSetupPanel must exist');
    // Wizard routes to /api/fleet/setup/${action} via template literal — check base path
    assert.ok(src.includes('/api/fleet/setup/'), 'wizard must route to server fleet setup API');
  });

  it('fleet inventory payload includes devices', () => {
    const payload = fleetInventoryPayload();
    assert.equal(payload.ok, true, 'inventory payload ok must be true');
    assert.ok(Array.isArray(payload.inventory.devices), 'inventory.devices must be array');
  });
});

// AC5: handleFleetSetupApi rejects unknown routes and wrong methods
describe('AC5: fleet setup API route guards', () => {
  it('handleFleetSetupApi rejects unknown action', async () => {
    const calls = [];
    const fakeRes = {};
    const jsonRes = (res, code, body) => calls.push({ code, body });
    await handleFleetSetupApi(
      { method: 'POST' }, fakeRes, '/api/fleet/setup/unknown', jsonRes
    );
    assert.equal(calls[0].code, 404, 'unknown route must return 404');
  });

  it('handleFleetSetupApi rejects GET on POST-only routes', async () => {
    const calls = [];
    const fakeRes = {};
    const jsonRes = (res, code, body) => calls.push({ code, body });
    await handleFleetSetupApi(
      { method: 'GET' }, fakeRes, '/api/fleet/setup/discover', jsonRes
    );
    assert.equal(calls[0].code, 405, 'GET on discover must return 405');
  });
});
