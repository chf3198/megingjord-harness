'use strict';
const { test, expect } = require('@playwright/test');
const { execFileSync } = require('child_process');
const path = require('path');

test('baton handoff authority Python suite passes (#3204)', () => {
  const root = path.resolve(__dirname, '..');
  execFileSync('python3', ['-m', 'unittest', 'tests.hooks.test_baton_handoff_checks'], {
    cwd: root, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'],
  });
  expect(true).toBe(true);
});
