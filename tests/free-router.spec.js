// Tests for #786 free-model orchestrator
const { test, expect } = require('@playwright/test');
const fs = require('fs');
const path = require('path');
const os = require('os');

const ROUTER = '../scripts/global/free-router';

let originalCwd;
let tmpDir;

test.beforeEach(() => {
  originalCwd = process.cwd();
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'router-test-'));
  fs.mkdirSync(path.join(tmpDir, '.dashboard'), { recursive: true });
  process.chdir(tmpDir);
  delete require.cache[require.resolve(ROUTER)];
});

test.afterEach(() => {
  process.chdir(originalCwd);
});

test('classifier picks fleet-fim on completion-style task', () => {
  const { classify, TIERS } = require(ROUTER);
  expect(classify('autocomplete this function')).toEqual(TIERS.FIM);
});

test('classifier picks reasoning tier on architecture task', () => {
  const { classify, TIERS } = require(ROUTER);
  expect(classify('design the authentication architecture').tier).toBe('premium');
});

test('classifier picks fleet-coder on refactor task', () => {
  const { classify, TIERS } = require(ROUTER);
  expect(classify('refactor extract method').tier).toBe('fleet-coder');
});

test('classifier picks free-cloud on docs task', () => {
  const { classify } = require(ROUTER);
  expect(classify('write README docs').tier).toBe('free-cloud');
});

test('_hasFreeLLM returns false when no free providers available', () => {
  const { _hasFreeLLM } = require(ROUTER);
  expect(_hasFreeLLM({ providers: {} })).toBe(false);
  expect(_hasFreeLLM({ providers: { groq: { available: false } } })).toBe(false);
  expect(_hasFreeLLM({ providers: { groq: { available: true } } })).toBe(true);
});

test('route returns classifier-only when no manifest', async () => {
  const { route } = require(ROUTER);
  const r = await route('autocomplete this');
  expect(r.source).toBe('classifier-only');
  expect(r.reason).toBe('no-free-llm');
});

test('route uses signal-stack pick when manifest has no free LLM', async () => {
  fs.writeFileSync(path.join(tmpDir, '.dashboard', 'capabilities.json'), JSON.stringify({
    providers: { anthropic: { available: true } },
  }));
  delete require.cache[require.resolve(ROUTER)];
  const { route, TIERS } = require(ROUTER);
  const r = await route('autocomplete this function');
  expect(r.source).toBe('classifier-only');
  expect(r.tier).toBe(TIERS.FIM.tier);
});
