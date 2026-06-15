// Refs #2802 P1-0 slice 3 — fleet context dispatch helper (D12/D15). Network-free tests.
const { test, expect } = require('@playwright/test');
const path = require('path');
const {
  buildContextualPrompt, dispatchWithContext,
} = require('../scripts/global/fleet-context-dispatch.js');
const { validateContextEnvelope } = require('../scripts/global/fleet-envelope-contract.js');

const SELF = 'scripts/global/fleet-context-dispatch.js';
const ROOT_OPTS = { paths: [SELF], task: 'Review this.' }; // repo-map only → no network

test('#2802 buildContextualPrompt prepends auto-assembled context to the task', () => {
  const { prompt, included } = buildContextualPrompt(ROOT_OPTS);
  expect(prompt).toContain('=== AUTO-ASSEMBLED CONTEXT');
  expect(prompt).toContain('=== TASK ===\nReview this.');
  expect(prompt.indexOf('AUTO-ASSEMBLED')).toBeLessThan(prompt.indexOf('TASK')); // context before task
  expect(included).toContain('repoMap');
});

test('#3012 buildContextualPrompt emits canonical observability envelope', () => {
  const out = buildContextualPrompt(ROOT_OPTS);
  expect(out.observability).toEqual({
    schema: 'fleet-context-envelope/v1',
    manifestSchema: 'fleet-context-bundle/v1',
    included: out.included,
    truncated: out.truncated,
  });
});

test('#2802 buildContextualPrompt with no context returns the bare task', () => {
  const { prompt, included } = buildContextualPrompt({ task: 'just do it' });
  expect(prompt).toBe('just do it');
  expect(included).toEqual([]);
});

test('#2802 buildContextualPrompt header notes truncation under a tight budget', () => {
  const { prompt, truncated } = buildContextualPrompt({ ...ROOT_OPTS, maxContextChars: 30 });
  expect(truncated).toBe(true);
  expect(prompt).toContain('truncated to budget');
});

test('#3012 buildContextualPrompt rejects malformed envelope payloads', () => {
  expect(() => buildContextualPrompt({ task: 'x', paths: [''] })).toThrow(/paths must be an array of non-empty strings/);
  expect(() => buildContextualPrompt({ task: 'x', maxContextChars: 0 })).toThrow(/maxContextChars must be a positive integer/);
  expect(() => buildContextualPrompt({ task: 'x', wikiQuery: 42 })).toThrow(/wikiQuery must be a string/);
  expect(() => buildContextualPrompt({ task: 42 })).toThrow(/task must be a string/);
});

test('#3012 buildContextualPrompt validates the returned envelope as a whole', () => {
  const out = buildContextualPrompt(ROOT_OPTS);
  expect(out.prompt).toBeTruthy();
  expect(out.observability.truncated).toBe(out.truncated);
  expect(out.observability.included).toEqual(out.included);
  expect(out.observability.manifestSchema).toBe(out.manifest.schema);
});

test('#3012 validateContextEnvelope rejects tampered observability or manifest data', () => {
  const out = buildContextualPrompt(ROOT_OPTS);
  expect(() => validateContextEnvelope({
    ...out,
    manifest: { ...out.manifest, schema: 'fleet-context-bundle/v9' },
  })).toThrow(/manifest schema must be fleet-context-bundle\/v1/);
  expect(() => validateContextEnvelope({
    ...out,
    observability: { ...out.observability, included: ['ticket'] },
  })).toThrow(/observability\.included must match included/);
});

test('#2802 dispatchWithContext calls the injected dispatch with the built prompt', async () => {
  let seen = null;
  const out = await dispatchWithContext({ ...ROOT_OPTS, dispatch: async (p) => { seen = p; return 'OK'; } });
  expect(seen).toContain('=== TASK ===\nReview this.');
  expect(out.result).toBe('OK');
  expect(out.included).toContain('repoMap');
  expect(out.manifest.schema).toBe('fleet-context-bundle/v1');
  expect(out.observability.schema).toBe('fleet-context-envelope/v1');
});

test('#2802 dispatchWithContext throws a clear error when no dispatch wired', async () => {
  await expect(dispatchWithContext({ task: 'x' })).rejects.toThrow(/opts.dispatch.*required/);
});
