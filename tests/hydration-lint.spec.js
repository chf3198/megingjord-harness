// #2771 — hydration-lint prevention gate: dotenv-outside-shim, unhydrated-consumer, value-leak,
// plus the repo-wide assertion that the #2769 sweep left zero violations.
const { test, expect } = require('@playwright/test');
const { scanText, credentialAlternation, lintRepo } = require('../scripts/global/hydration-lint');

const CRED = credentialAlternation({ default: ['_API_KEY', '_TOKEN', '_SECRET', '_KEY', 'PASSWORD'] });

test('R1: flags require(dotenv) outside the shim', () => {
  const v = scanText('scripts/x.js', "const x = require('dotenv').config();", CRED);
  expect(v.some((f) => f.rule === 'dotenv-outside-shim')).toBe(true);
});

test('R2: flags a credential process.env read with no hydration reference', () => {
  const v = scanText('scripts/x.js', 'const k = process.env.OPENAI_API_KEY;', CRED);
  expect(v.some((f) => f.rule === 'unhydrated-consumer')).toBe(true);
});

test('R2: a credential read WITH loadLocalEnvOnce present is clean', () => {
  const v = scanText('scripts/x.js',
    "require('./load-local-env').loadLocalEnvOnce();\nconst k = process.env.OPENAI_API_KEY;", CRED);
  expect(v.length).toBe(0);
});

test('R2: bracket-style credential access is also caught', () => {
  const v = scanText('scripts/x.js', "const k = process.env['GITHUB_TOKEN'];", CRED);
  expect(v.some((f) => f.rule === 'unhydrated-consumer')).toBe(true);
});

test('R3: flags a console call that embeds a credential value (value-leak)', () => {
  const v = scanText('scripts/x.js',
    "require('./load-local-env').loadLocalEnvOnce();\nconsole.log(process.env.ANTHROPIC_API_KEY);", CRED);
  expect(v.some((f) => f.rule === 'credential-value-leak')).toBe(true);
});

test('no false positive: a non-credential env read is ignored', () => {
  const v = scanText('scripts/x.js', 'const port = process.env.PORT;', CRED);
  expect(v.length).toBe(0);
});

test('exemption: the shim itself and the dashboard fragment are not flagged', () => {
  expect(scanText('scripts/global/load-local-env.js', "require('dotenv')", CRED).length).toBe(0);
  expect(scanText('scripts/dashboard-api-handlers.js', 'const k = process.env.OPENROUTER_API_KEY;', CRED).length)
    .toBe(0);
});

test('repo-wide: the #2769 sweep leaves zero hydration violations', () => {
  const findings = lintRepo();
  expect(findings, `expected clean repo, got: ${JSON.stringify(findings)}`).toEqual([]);
});
