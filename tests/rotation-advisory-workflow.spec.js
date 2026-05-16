'use strict';

const { test, expect } = require('@playwright/test');
const fs = require('node:fs');
const path = require('node:path');

const WORKFLOW_PATH = path.join(__dirname, '..', '.github', 'workflows', 'rotation-advisory.yml');
const TS_ROUTE_PATH = path.join(__dirname, '..', 'cloudflare', 'hamr', 'routes', 'rotation-check.ts');
const DISPATCH_PATH = path.join(__dirname, '..', 'cloudflare', 'hamr', 'routes', 'mcp-dispatch.ts');

function read(p) { return fs.readFileSync(p, 'utf8'); }

test('rotation-advisory.yml triggers on pull_request events', () => {
  const yml = read(WORKFLOW_PATH);
  expect(yml).toContain('pull_request:');
  expect(yml).toContain('types: [opened, synchronize, reopened, ready_for_review]');
});

test('rotation-advisory.yml has scoped least-privilege permissions', () => {
  const yml = read(WORKFLOW_PATH);
  expect(yml).toContain('contents: read');
  expect(yml).toContain('issues: write');
  expect(yml).toContain('pull-requests: write');
});

test('rotation-advisory.yml pins actions to SHA', () => {
  const yml = read(WORKFLOW_PATH);
  expect(yml).toContain('actions/checkout@34e114876b0b11c390a56381ad16ebd13914f8d5');
  expect(yml).toContain('actions/github-script@f28e40c7f34bde8b3046d885e986cb6290c5673b');
});

test('rotation-advisory.yml imports both helper + adapter', () => {
  const yml = read(WORKFLOW_PATH);
  expect(yml).toContain('baton-team-model-v2.js');
  expect(yml).toContain('hamr-rotation-check.js');
});

test('rotation-advisory.yml uses HTML-comment marker to dedupe comments', () => {
  const yml = read(WORKFLOW_PATH);
  expect(yml).toContain('<!-- rotation-advisory -->');
});

test('rotation-check.ts route exports rotationCheck function', () => {
  const ts = read(TS_ROUTE_PATH);
  expect(ts).toContain('export function rotationCheck');
  expect(ts).toContain('checkRule1');
  expect(ts).toContain('checkRule2');
  expect(ts).toContain('checkRule3');
});

test('rotation-check.ts honors single-model-fleet mode', () => {
  const ts = read(TS_ROUTE_PATH);
  expect(ts).toContain("'single-model-fleet'");
  expect(ts).toContain("'model-diversity:waived'");
  expect(ts).toContain("'rotation-required-waived'");
});

test('mcp-dispatch.ts wires rotation:check capability', () => {
  const ts = read(DISPATCH_PATH);
  expect(ts).toContain("case 'rotation:check'");
  expect(ts).toContain("import { rotationCheck }");
  expect(ts).toContain("'rotation:check'");
});

test('inventory has cryptoKeys for all 4 teams', () => {
  const inv = JSON.parse(read(path.join(__dirname, '..', 'inventory', 'team-model-signatures.json')));
  const teams = new Set(inv.cryptoKeys.map(k => k.team));
  expect(teams.has('claude-code')).toBe(true);
  expect(teams.has('codex')).toBe(true);
  expect(teams.has('copilot')).toBe(true);
  expect(teams.has('openclaw')).toBe(true);
});

test('inventory has cryptoKeys for all 4 roles per team', () => {
  const inv = JSON.parse(read(path.join(__dirname, '..', 'inventory', 'team-model-signatures.json')));
  const roles = ['manager', 'collaborator', 'admin', 'consultant'];
  for (const team of ['claude-code', 'codex', 'copilot', 'openclaw']) {
    for (const role of roles) {
      const found = inv.cryptoKeys.find(k => k.team === team && k.role === role);
      expect(found, `missing ${team}-${role}`).toBeTruthy();
      expect(found.keyId).toBe(`${team}-${role}-v1`);
      expect(found.publicKey).toContain('BEGIN PUBLIC KEY');
    }
  }
});

test('JS adapter logic mirrors TS route logic for Rule 3 fail case', () => {
  const adapter = require('../scripts/global/hamr-rotation-check.js');
  const result = adapter.rotationCheck({
    operator_mode: 'strict-rotation',
    roles_observed: {
      manager: 'claude-code:opus@anthropic',
      collaborator: 'codex:gpt-5@openai',
      admin: 'copilot:opus@github-copilot',
      consultant: 'codex:gpt-5@openai',
    },
  });
  expect(result.decision).toBe('fail');
  expect(result.rule_evaluated).toBe('rule_3_consultant_independent');
});
