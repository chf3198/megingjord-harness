'use strict';

const { test, expect } = require('@playwright/test');
const fs = require('node:fs');
const path = require('node:path');

const FILE = path.resolve(__dirname, '..', 'lefthook.yml');
const FIXTURE = path.resolve(__dirname, 'fixtures', 'lefthook-pre-push.required.txt');

test('lefthook pre-push includes required parity gates', () => {
  const content = fs.readFileSync(FILE, 'utf8');
  const required = fs.readFileSync(FIXTURE, 'utf8').trim().split('\n').filter(Boolean);
  for (const marker of required) expect(content).toContain(marker);
});
