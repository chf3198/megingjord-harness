#!/usr/bin/env node
'use strict';
const { test, expect } = require('@playwright/test');
const path = require('node:path');
const { run, scanFile } = require('../scripts/global/inventory-portability-check');

test('example inventory has no Tailscale IPs', () => {
  const result = scanFile(require('node:path').join(__dirname, '../inventory/devices.example.json'));
  expect(result.hits).toEqual([]);
});

test('portability check passes on git-tracked inventory', () => {
  const result = run(path.join(__dirname, '..'));
  expect(result.ok).toBe(true);
});
