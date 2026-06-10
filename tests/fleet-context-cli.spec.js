// Refs #2831 (P1-0 child of #2802) — fleet context CLI. Network-free: dispatch is injected.
const { test, expect } = require('@playwright/test');
const {
  parseArgs, numericOpt, toContextOpts, freeCloudDispatch, runCli,
} = require('../scripts/global/fleet-context-cli.js');

const SELF = 'scripts/global/fleet-context-cli.js'; // a real text file → repo-map only, no network

test('#2831 parseArgs handles --flag value, --flag=value, and ignores non-flags', () => {
  expect(parseArgs(['--ticket', '2802', '--task=hi', 'stray', '--wiki', 'q']))
    .toEqual({ ticket: '2802', task: 'hi', wiki: 'q' });
  expect(parseArgs(['--flag'])).toEqual({ flag: '' }); // trailing valueless flag → empty string
});

test('#2831 parseArgs does NOT swallow a following flag as a value (gemini REJECT finding)', () => {
  expect(parseArgs(['--flag1', '--flag2'])).toEqual({ flag1: '', flag2: '' });
  expect(parseArgs(['--a', '--b', 'v'])).toEqual({ a: '', b: 'v' });
});

test('#2831 numericOpt rejects non-numeric input (fail fast, no silent NaN)', () => {
  expect(numericOpt('ticket', '2802')).toBe(2802);
  expect(numericOpt('n', '0')).toBe(0); // legit zero still accepted
  expect(() => numericOpt('ticket', 'invalid')).toThrow(/--ticket must be a number, got 'invalid'/);
  expect(() => numericOpt('ticket', '')).toThrow(/--ticket must be a number/); // valueless flag → not silently 0
  expect(() => numericOpt('ticket', '   ')).toThrow(/--ticket must be a number/);
  expect(() => toContextOpts({ 'max-context-chars': 'NaNnope' })).toThrow(/--max-context-chars must be a number/);
});

test('#2831 toContextOpts parses numbers + splits paths', () => {
  const out = toContextOpts({ ticket: '2802', paths: 'a.js, b.js ,', wiki: 'q', 'max-context-chars': '500', task: 't' });
  expect(out).toEqual({ task: 't', ticket: 2802, paths: ['a.js', 'b.js'], wikiQuery: 'q', maxContextChars: 500 });
});

test('#2831 toContextOpts defaults task to empty and omits unset fields', () => {
  expect(toContextOpts({})).toEqual({ task: '' });
});

test('#2831 freeCloudDispatch returns content+provider on ok', async () => {
  const out = await freeCloudDispatch('p', async () => ({ ok: true, content: 'ANSWER', provider: 'gemini' }));
  expect(out).toEqual({ content: 'ANSWER', provider: 'gemini' });
});

test('#2831 freeCloudDispatch throws the cascade reason on failure (G6 surfaces why)', async () => {
  await expect(freeCloudDispatch('p', async () => ({ ok: false, reason: 'no_free_cloud_available', tried: ['gemini:no_key'] })))
    .rejects.toThrow(/free-cloud dispatch failed: no_free_cloud_available \(gemini:no_key\)/);
});

test('#2831 runCli assembles context + dispatches the rendered prompt (injected dispatch, no network)', async () => {
  let seen = null;
  const out = await runCli(['--paths', SELF, '--task', 'Review this.'], { dispatch: async (prompt) => { seen = prompt; return 'OK'; } });
  expect(seen).toContain('=== AUTO-ASSEMBLED CONTEXT');
  expect(seen).toContain('=== TASK ===\nReview this.');
  expect(out.result).toBe('OK');
  expect(out.included).toContain('repoMap');
  expect(out.manifest.schema).toBe('fleet-context-bundle/v1');
});

test('#2831 runCli with only a task dispatches the bare task', async () => {
  let seen = null;
  await runCli(['--task', 'just do it'], { dispatch: async (prompt) => { seen = prompt; return 'OK'; } });
  expect(seen).toBe('just do it');
});
