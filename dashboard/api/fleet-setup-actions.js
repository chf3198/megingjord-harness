#!/usr/bin/env node
'use strict';
// #3173 — POST discover/credentials/probe for fleet setup wizard.
const { execFile } = require('node:child_process');
const path = require('node:path');
const { promisify } = require('node:util');
const execFileAsync = promisify(execFile);
const { setCredential } = require('../../scripts/global/harness-credential-write');
const probe = require('../../scripts/global/capability-probe');

const ROOT = path.resolve(__dirname, '..', '..');

async function readJsonBody(req) {
  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);
  const raw = Buffer.concat(chunks).toString('utf8').trim();
  return raw ? JSON.parse(raw) : {};
}

async function runDiscover() {
  await execFileAsync('bash', ['scripts/global/fleet-discover.sh'], { cwd: ROOT, timeout: 120000 });
  return { ok: true, action: 'discover' };
}

async function runProbe() {
  await probe.probe();
  return { ok: true, action: 'probe' };
}

async function saveCredentials(body) {
  const name = String(body.name || '').trim();
  const value = String(body.value || '').trim();
  const result = setCredential(name, value, { root: ROOT });
  return { ok: true, action: 'credentials', name: result.name, method: result.method };
}

async function dispatchFleetSetup(action, req) {
  if (action === 'discover') return runDiscover();
  if (action === 'probe') return runProbe();
  if (action === 'credentials') return saveCredentials(await readJsonBody(req));
  throw new Error(`unknown fleet setup action: ${action}`);
}

module.exports = { dispatchFleetSetup, readJsonBody, runDiscover, runProbe, saveCredentials };
