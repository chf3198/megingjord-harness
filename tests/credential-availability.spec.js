'use strict';
// #2569: unit tests for the credential pre-prompt guard. G1 (don't ask the client for a local secret),
// G4 (never expose the value), AC3 anti-over-block, AC4 absent-action, AC5 recurrence cases.
const assert = require('node:assert/strict');
const os = require('node:os');
const fs = require('node:fs');
const path = require('node:path');
const { test } = require('node:test');
const { isSecretLocallyAvailable, classifyCredentialRequest, preCredentialPromptCheck } =
  require('../scripts/global/credential-availability.js');

function tmpEnv(contents) {
  const file = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'cred2569-')), '.env');
  fs.writeFileSync(file, contents);
  return file;
}

test('available from process.env (value never inspected by caller)', () => {
  assert.equal(isSecretLocallyAvailable('FOO_TOKEN', { env: { FOO_TOKEN: 'x' } }), true);
});

test('AC5 recurrence: TAVILY_API_KEY / GITHUB_CLIENT_SECRET resolve from approved local .env', () => {
  const file = tmpEnv('TAVILY_API_KEY=tvly-SECRET\nGITHUB_CLIENT_SECRET=ghs-SECRET');
  assert.equal(isSecretLocallyAvailable('TAVILY_API_KEY', { env: {}, path: file }), true);
  assert.equal(isSecretLocallyAvailable('GITHUB_CLIENT_SECRET', { env: {}, path: file }), true);
});

test('AC5: absent secret reports false (no throw, value-free)', () => {
  const file = tmpEnv('OTHER=1');
  assert.equal(isSecretLocallyAvailable('TAVILY_API_KEY', { env: {}, path: file }), false);
});

test('empty-string env value is treated as absent', () => {
  assert.equal(isSecretLocallyAvailable('K', { env: { K: '' }, path: '/no/such/.env' }), false);
});

test('AC3 anti-over-block: credential requests flagged, ordinary clarification not', () => {
  assert.equal(classifyCredentialRequest('please paste your Tavily API key').isSecretRequest, true);
  assert.equal(classifyCredentialRequest('what is your OPENAI_API_KEY?').isSecretRequest, true);
  assert.equal(classifyCredentialRequest('which file should I edit?').isSecretRequest, false);
  assert.equal(classifyCredentialRequest('what color for the header?').isSecretRequest, false);
});

test('AC2 guard: any locally-available secret yields action use-local (no client prompt)', () => {
  const out = preCredentialPromptCheck(['A_TOKEN', 'B_TOKEN'], { env: { A_TOKEN: 'x' } });
  assert.deepEqual(out.available, ['A_TOKEN']);
  assert.equal(out.action, 'use-local');
});

test('AC4 absent behavior: all-absent yields report-absent-no-prompt (never request raw secret)', () => {
  const out = preCredentialPromptCheck(['NOPE_TOKEN'], { env: {}, path: '/no/such/.env' });
  assert.deepEqual(out.absent, ['NOPE_TOKEN']);
  assert.equal(out.action, 'report-absent-no-prompt');
});
