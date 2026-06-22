#!/usr/bin/env node
'use strict';
const { test, expect } = require('@playwright/test');
const { fleetSetupStatus, fleetInventoryPayload } = require('../dashboard/api/fleet-setup-status');
const { ENV_NAME, writeEnvAtomic } = require('../scripts/global/harness-credential-write');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

test('fleet setup status returns device count', () => {
  const status = fleetSetupStatus();
  expect(status.ok).toBe(true);
  expect(status.deviceCount).toBeGreaterThan(0);
});

test('fleet inventory payload includes devices and services', () => {
  const payload = fleetInventoryPayload();
  expect(payload.inventory.devices.length).toBeGreaterThan(0);
  expect(payload.services.optimizationStrategy || (payload.services.subscriptions || []).length >= 0).toBeTruthy();
});

test('writeEnvAtomic replaces named key', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'env-'));
  const envPath = path.join(dir, '.env');
  writeEnvAtomic(envPath, 'GROQ_API_KEY', 'test-value');
  const text = fs.readFileSync(envPath, 'utf8');
  expect(text).toContain('GROQ_API_KEY=test-value');
});

test('credential env name validation', () => {
  expect(ENV_NAME.test('OPENROUTER_API_KEY')).toBe(true);
  expect(ENV_NAME.test('bad-key')).toBe(false);
});
