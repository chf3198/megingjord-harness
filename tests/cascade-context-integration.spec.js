// #3008 AC-E6 — cascade uses context envelope when ticket provided.
'use strict';
const { test, expect } = require('@playwright/test');
const { resolvePrompt } = require('../scripts/global/cascade-dispatch');

test('resolvePrompt passes through bare prompt without context opts', () => {
  expect(resolvePrompt('hello', {})).toBe('hello');
});

test('resolvePrompt degrades gracefully when envelope assembly fails', () => {
  const out = resolvePrompt('task body', { paths: ['package.json'] });
  expect(out).toContain('task body');
});
