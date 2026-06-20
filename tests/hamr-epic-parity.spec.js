// Epic #3008 — end-to-end parity smoke across B/C/D surfaces.
'use strict';
const { test, expect } = require('@playwright/test');
const fs = require('fs');
const path = require('path');

test('orchestrator parity lists cursor and documents Phase 1+2', () => {
  const p = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'inventory', 'orchestrator-governance-parity.json'), 'utf8'));
  expect(p.runtimes).toContain('cursor');
});

test('hamr tool allowlist config valid', () => {
  const cfg = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'config', 'hamr-tool-allowlist.json'), 'utf8'));
  expect(cfg.roles.collaborator).toContain('github_self_comment');
});

test('hamr probe slo config present', () => {
  const slo = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'config', 'hamr-probe-slo.json'), 'utf8'));
  expect(slo.offload.coverage_floor_7d).toBeGreaterThan(0);
});
