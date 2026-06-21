#!/usr/bin/env node
'use strict';
// #3170 — resolve-inventory merge precedence (Epic #3162 AC1, AC3, AC4).
const { test, expect } = require('@playwright/test');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { resolveInventory, mergeDeviceList, envKeyForDevice } = require('../scripts/global/resolve-inventory');

function tmpOverlay(devices) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'inv-'));
  fs.writeFileSync(path.join(dir, 'devices.json'), JSON.stringify({ devices }, null, 2));
  return dir;
}

test('example-only solo mode returns generic devices', () => {
  const doc = resolveInventory('devices', { localDir: path.join(os.tmpdir(), 'missing-overlay'), probeEnrich: false });
  expect(doc.devices.length).toBeGreaterThan(0);
  expect(doc.devices.some((d) => d.id === 'operator-host')).toBe(true);
  expect(doc._source.overlay).toBe(false);
});

test('overlay merges by device id with field replace', () => {
  const base = [{ id: 'fleet-gpu', hostname: 'old', ollamaModels: ['a:7b'] }];
  const over = [{ id: 'fleet-gpu', hostname: 'new-host', ollamaModels: ['b:14b'] }];
  const merged = mergeDeviceList(base, over);
  expect(merged).toHaveLength(1);
  expect(merged[0].hostname).toBe('new-host');
  expect(merged[0].ollamaModels).toEqual(['b:14b']);
});

test('FLEET_IP env overrides tailscaleIP', () => {
  const key = envKeyForDevice('fleet-gpu');
  const prior = process.env[key];
  process.env[key] = '100.1.2.3';
  try {
    const doc = resolveInventory('devices', { localDir: path.join(os.tmpdir(), 'no-overlay'), probeEnrich: false });
    const gpu = doc.devices.find((d) => d.id === 'fleet-gpu');
    expect(gpu?.tailscaleIP).toBe('100.1.2.3');
  } finally {
    if (prior === undefined) delete process.env[key];
    else process.env[key] = prior;
  }
});

test('local overlay wins over example baseline', () => {
  const dir = tmpOverlay([{ id: 'operator-host', hostname: 'my-laptop', local: true }]);
  const doc = resolveInventory('devices', { localDir: dir, probeEnrich: false });
  const host = doc.devices.find((d) => d.id === 'operator-host');
  expect(host.hostname).toBe('my-laptop');
  expect(doc._source.overlay).toBe(true);
});
