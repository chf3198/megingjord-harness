#!/usr/bin/env node
'use strict';
const { execSync } = require('child_process');
const path = require('path');
const fs = require('fs');

function loadInventory() {
  const inv = path.resolve(__dirname, '..', '..', 'inventory', 'devices.json');
  if (!fs.existsSync(inv)) return [];
  return JSON.parse(fs.readFileSync(inv, 'utf8')).devices || [];
}

function detectTailscale() {
  try {
    const out = execSync('tailscale status --json 2>/dev/null || sudo tailscale status --json', {
      encoding: 'utf8', timeout: 5000
    });
    const st = JSON.parse(out);
    const peers = {};
    if (st.Self) peers[st.Self.TailscaleIPs?.[0]] = 'online';
    for (const [, p] of Object.entries(st.Peer || {})) {
      const ip = p.TailscaleIPs?.[0];
      if (ip) peers[ip] = p.Online ? 'online' : 'offline';
    }
    return { ok: true, peers };
  } catch { return { ok: false, peers: {} }; }
}

function resolveFleet() {
  const devices = loadInventory();
  const ts = detectTailscale();
  return devices.map(d => {
    const ip = process.env[`FLEET_IP_${d.id.toUpperCase().replace(/-/g, '_')}`]
      || d.tailscaleIP || null;
    const status = ip && ts.peers[ip] ? ts.peers[ip] : 'unknown';
    return { ...d, resolvedIP: ip, reachable: status === 'online' };
  });
}

function getProfile() {
  const fleet = resolveFleet();
  const online = fleet.filter(d => d.reachable && !d.local);
  if (online.length === 0) return { mode: 'solo', fleet };
  if (online.length < fleet.filter(d => !d.local).length) return { mode: 'degraded', fleet };
  return { mode: 'full', fleet };
}

function getDeviceURL(deviceId, port) {
  const fleet = resolveFleet();
  const d = fleet.find(x => x.id === deviceId);
  if (!d?.resolvedIP) return null;
  return `http://${d.resolvedIP}:${port || 11434}`;
}

function getOpenClawURL() {
  return process.env.OPENCLAW_URL || getDeviceURL('windows-laptop', 4000);
}

if (require.main === module) {
  const cmd = process.argv[2];
  if (cmd === 'profile') console.log(JSON.stringify(getProfile(), null, 2));
  else if (cmd === 'fleet') console.log(JSON.stringify(resolveFleet(), null, 2));
  else console.log('Usage: fleet-config.js [profile|fleet]');
}

module.exports = { loadInventory, resolveFleet, getProfile, getDeviceURL, getOpenClawURL };
