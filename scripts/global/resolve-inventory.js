#!/usr/bin/env node
'use strict';
// #3170 — operator-local inventory overlay merge (Epic #3162 Phase-1 D3).
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const KINDS = { devices: { example: 'devices.example.json', local: 'devices.json' } };
const REPO = path.resolve(__dirname, '..', '..', 'inventory');
const LOCAL = path.join(os.homedir(), '.megingjord');

function readJson(file) {
  if (!fs.existsSync(file)) return null;
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}

function envKeyForDevice(id) {
  return `FLEET_IP_${String(id).toUpperCase().replace(/-/g, '_')}`;
}

function mergeDeviceList(base, overlay) {
  const map = new Map((base || []).map((d) => [d.id, { ...d }]));
  for (const d of overlay || []) {
    const prev = map.get(d.id) || {};
    const merged = { ...prev, ...d };
    if (Array.isArray(d.ollamaModels)) merged.ollamaModels = d.ollamaModels.slice();
    map.set(d.id, merged);
  }
  return [...map.values()];
}

function applyEnvDevices(devices) {
  return devices.map((d) => {
    const ip = process.env[envKeyForDevice(d.id)];
    return ip ? { ...d, tailscaleIP: ip, ip } : d;
  });
}

function enrichFromProbe(doc, root) {
  const cap = readJson(path.join(root || process.cwd(), '.dashboard', 'capabilities.json'));
  if (!cap?.fleet) return doc;
  const devices = (doc.devices || []).map((d) => {
    const p = cap.fleet[d.id];
    if (!p) return d;
    return { ...d, probeReachable: p.reachable, probeModels: p.models };
  });
  return { ...doc, devices };
}

function resolveInventory(kind = 'devices', opts = {}) {
  const spec = KINDS[kind];
  if (!spec) throw new Error(`unknown inventory kind: ${kind}`);
  const localDir = opts.localDir || LOCAL;
  const baseline = readJson(path.join(REPO, spec.example)) || {};
  const overlay = readJson(path.join(localDir, spec.local)) || {};
  let doc = { ...baseline, ...overlay };
  if (kind === 'devices') {
    doc.devices = applyEnvDevices(mergeDeviceList(baseline.devices, overlay.devices));
    if (opts.probeEnrich !== false) doc = enrichFromProbe(doc, opts.repoRoot || path.join(REPO, '..'));
  }
  doc._source = { kind, example: spec.example, overlay: fs.existsSync(path.join(localDir, spec.local)) };
  return doc;
}

module.exports = { resolveInventory, mergeDeviceList, applyEnvDevices, envKeyForDevice, KINDS };
