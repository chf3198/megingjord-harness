#!/usr/bin/env node
'use strict';
const { execSync } = require('child_process');
const { getProfile, getOpenClawURL } = require('./fleet-config');

const dryRun = process.argv.includes('--dry-run');
const json = process.argv.includes('--json');

function run(cmd) {
  if (dryRun) return { ok: true, out: `DRY_RUN ${cmd}` };
  try { return { ok: true, out: execSync(cmd, { encoding: 'utf8', timeout: 10000 }).trim() }; }
  catch (e) { return { ok: false, out: (e.stdout || e.message || '').toString().trim() }; }
}

const profile = getProfile();
if (profile.mode === 'solo') {
  const r = { ok: false, dryRun, mode: 'solo', reason: 'No fleet nodes reachable' };
  if (json) console.log(JSON.stringify(r, null, 2));
  else console.log('OpenClaw preflight: SKIP (solo mode — no fleet)');
  process.exit(2);
}

const ocURL = getOpenClawURL();
const checks = [
  { key: 'tailscale', cmd: 'sudo tailscale status || tailscale status' },
  { key: 'openclaw', cmd: `curl -sf --max-time 5 ${ocURL}/health` }
].map(c => ({ ...c, result: run(c.cmd) }));

const ok = checks.every(c => c.result.ok);
if (json) console.log(JSON.stringify({ ok, dryRun, mode: profile.mode, checks }, null, 2));
else {
  console.log(`OpenClaw preflight (mode: ${profile.mode})`);
  checks.forEach(c => console.log(`- ${c.key}: ${c.result.ok ? 'OK' : 'FAIL'}`));
}
process.exit(ok ? 0 : 2);
