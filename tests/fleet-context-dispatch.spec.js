// Refs #2802 P1-0 slice 3 — fleet context dispatch helper (D12/D15). Network-free tests.
const { test, expect } = require('@playwright/test');
const path = require('path');
const {
  buildContextualPrompt, dispatchWithContext,
} = require('../scripts/global/fleet-context-dispatch.js');

const SELF = 'scripts/global/fleet-context-dispatch.js';
const ROOT_OPTS = { paths: [SELF], task: 'Review this.' }; // repo-map only → no network

test('#2802 buildContextualPrompt prepends auto-assembled context to the task', () => {
  const { prompt, included } = buildContextualPrompt(ROOT_OPTS);
  expect(prompt).toContain('=== AUTO-ASSEMBLED CONTEXT');
  expect(prompt).toContain('=== TASK ===\nReview this.');
  expect(prompt.indexOf('AUTO-ASSEMBLED')).toBeLessThan(prompt.indexOf('TASK')); // context before task
  expect(included).toContain('repoMap');
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

test('#2802 dispatchWithContext calls the injected dispatch with the built prompt', async () => {
  let seen = null;
  const out = await dispatchWithContext({ ...ROOT_OPTS, dispatch: async (p) => { seen = p; return 'OK'; } });
  expect(seen).toContain('=== TASK ===\nReview this.');
  expect(out.result).toBe('OK');
  expect(out.included).toContain('repoMap');
  expect(out.manifest.schema).toBe('fleet-context-bundle/v1');
});

test('#2802 dispatchWithContext throws a clear error when no dispatch wired', async () => {
  await expect(dispatchWithContext({ task: 'x' })).rejects.toThrow(/opts.dispatch.*required/);
});
