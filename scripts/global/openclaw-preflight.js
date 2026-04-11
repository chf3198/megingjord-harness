#!/usr/bin/env node
'use strict';
const { execSync } = require('child_process');

const dryRun = process.argv.includes('--dry-run');
const json = process.argv.includes('--json');

function run(cmd) {
  if (dryRun) return { ok: true, out: `DRY_RUN ${cmd}` };
  try { return { ok: true, out: execSync(cmd, { encoding: 'utf8' }).trim() }; }
  catch (e) { return { ok: false, out: (e.stdout || e.message || '').toString().trim() }; }
}

const checks = [
  { key: 'tailscale', cmd: 'sudo tailscale status || tailscale status' },
  { key: 'ssh', cmd: 'ssh -o BatchMode=yes -o ConnectTimeout=8 windows-laptop "echo OK"' },
  { key: 'openclaw', cmd: 'ssh windows-laptop "openclaw health"' }
].map(c => ({ ...c, result: run(c.cmd) }));

const ok = checks.every(c => c.result.ok);
if (json) {
  console.log(JSON.stringify({ ok, dryRun, checks }, null, 2));
} else {
  console.log('OpenClaw preflight');
  checks.forEach(c => console.log(`- ${c.key}: ${c.result.ok ? 'OK' : 'FAIL'}`));
  if (!ok) checks.filter(c => !c.result.ok).forEach(c => console.log(`\n${c.key} output:\n${c.result.out}`));
}

process.exit(ok ? 0 : 2);
