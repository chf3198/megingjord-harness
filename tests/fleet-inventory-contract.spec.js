#!/usr/bin/env node
'use strict';
const { test, expect } = require('@playwright/test');
const { execFileSync } = require('node:child_process');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { resolveInventory } = require('../scripts/global/resolve-inventory');
const { harnessFleetDoctor } = require('../scripts/global/harness-fleet-doctor');

test('resolveInventory devices match example baseline ids', () => {
  const doc = resolveInventory('devices', { localDir: path.join(os.tmpdir(), 'no-overlay-contract'), probeEnrich: false });
  expect(doc.devices.some((device) => device.id === 'operator-host')).toBe(true);
});

test('fleet-discover claim: overlay path is optional', () => {
  const doc = resolveInventory('devices', { localDir: path.join(require('os').tmpdir(), 'no-overlay'), probeEnrich: false });
  expect(doc._source.overlay).toBe(false);
  expect(doc.devices.length).toBeGreaterThan(0);
});

test('harnessFleetDoctor returns structured report', () => {
  const report = harnessFleetDoctor({ json: true });
  expect(report).toHaveProperty('ready');
  expect(report).toHaveProperty('missingOptionalKeys');
});

test('fleet-config CLI exits zero', () => {
  execFileSync('node', ['scripts/global/fleet-config.js', 'fleet'], { cwd: path.join(__dirname, '..'), encoding: 'utf8' });
});

test('fleet-benchmark-runner loadDevices falls back to resolveInventory', () => {
  const { loadDevices } = require('../scripts/global/fleet-benchmark-runner');
  const doc = loadDevices({});
  expect(doc.devices.length).toBeGreaterThan(0);
});

test('skills reference overlay not tracked inventory/devices.json', () => {
  const root = path.join(__dirname, '..');
  for (const rel of ['skills/fleet-portable-config/SKILL.md', 'skills/network-platform-resources/SKILL.md']) {
    const text = fs.readFileSync(path.join(root, rel), 'utf8');
    expect(text).toMatch(/resolve-inventory|~\/\.megingjord/);
    expect(text).not.toMatch(/Edit tracked `inventory\/devices\.json`/);
  }
});
