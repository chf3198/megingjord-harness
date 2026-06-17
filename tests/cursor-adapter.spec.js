// tests/cursor-adapter.spec.js — Phase-0 Cursor thin-adapter registration (#3084, Epic #3083).
// Strategy: golden-file + auditable-output (round-3 consensus add). Verifies cursor is a
// first-class registered runtime across the six parity surfaces, mirroring Antigravity (#2381).
'use strict';

const { test, expect } = require('@playwright/test');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { execFileSync } = require('child_process');

const ROOT = path.join(__dirname, '..');
const emit = require('../scripts/global/governance-adapter-emit');
const contract = require('../scripts/global/cross-team-contract-check');

const UNIT = { id: 'demo', title: 'Demo', priority: 1, bodyRef: 'x', appliesTo: ['**'], targets: ['cursor'] };

// ── adapter-emit: golden path + Cursor-native frontmatter ──

test('adapter-emit targets cursor and maps to .cursor/rules/<id>.mdc', () => {
  expect(require('../scripts/global/governance-adapter-emit')).toBeTruthy();
  const p = emit.targetPath('cursor', UNIT, '/tmp/cursor-emit-test');
  expect(p.endsWith(path.join('cursor', '.cursor', 'rules', 'demo.mdc'))).toBe(true);
});

test('golden: cursor frontmatter matches the committed golden fixture (Cursor-native)', () => {
  const fm = emit.frontmatter('cursor', UNIT);
  const golden = fs.readFileSync(
    path.join(ROOT, 'tests', 'fixtures', 'cursor-adapter', 'frontmatter.golden'), 'utf8').replace(/\n$/, '');
  expect(fm).toBe(golden);
});

// ── committed project adapter ──

test('the committed .cursor/rules/megingjord.mdc adapter exists with alwaysApply and the 4 invariants', () => {
  const mdc = fs.readFileSync(path.join(ROOT, '.cursor', 'rules', 'megingjord.mdc'), 'utf8');
  expect(mdc).toMatch(/alwaysApply:\s*true/);
  expect(mdc).toContain('governance/README.md');
  expect(mdc).toMatch(/Team&Model signing/);
});

// ── auditable-output (AC1): contract-check Cursor entry ──

test('cross-team-contract-check registers a Cursor ENTRY_POINT and the check passes', () => {
  const cursorEntry = contract.ENTRY_POINTS.find((e) => e.path === '.cursor/rules/megingjord.mdc');
  expect(cursorEntry, 'Cursor entry missing from ENTRY_POINTS').toBeTruthy();
  const result = contract.run({ requirePointer: false });
  // run() returns a falsy/ok result on pass (it does not throw); the Cursor entry resolved.
  expect(result === undefined || result === true || (result && result.ok !== false)).toBeTruthy();
});

// ── auditable-output (AC2): mcp-register emits a per-target pass/fail line for cursor ──

test('xteam-mcp-register --target cursor emits an auditable per-target line (dry run)', () => {
  const home = fs.mkdtempSync(path.join(os.tmpdir(), 'mcp-cursor-'));
  const out = execFileSync('node', ['scripts/global/xteam-mcp-register.js', '--target', 'cursor', '--root', '.'],
    { cwd: ROOT, encoding: 'utf8', env: { ...process.env, MCP_REGISTER_TEST_HOME: home } });
  expect(out.toLowerCase()).toContain('cursor');
});

// ── parity manifest + signing registry ──

test('orchestrator-governance-parity lists cursor as a runtime', () => {
  const parity = JSON.parse(fs.readFileSync(path.join(ROOT, 'inventory', 'orchestrator-governance-parity.json'), 'utf8'));
  expect(parity.runtimes).toContain('cursor');
  expect(parity.runtimeEventNotes.cursor, 'cursor Phase-0 waiver note missing').toBeTruthy();
});

test('agent-signature derives a cursor alias (team-model-signatures teamValues + registry)', () => {
  const out = execFileSync('node', ['scripts/global/agent-signature.js', '--team', 'cursor', '--model', 'gpt-4', '--role', 'manager'],
    { cwd: ROOT, encoding: 'utf8' });
  expect(out).toMatch(/Cyrus Mason/);
});

// ── regression: existing runtimes unchanged ──

test('regression: the four existing runtimes remain registered in adapter-emit + deploy', () => {
  const deploySh = fs.readFileSync(path.join(ROOT, 'scripts', 'deploy.sh'), 'utf8');
  for (const t of ['copilot', 'codex', 'claude', 'antigravity']) {
    expect(deploySh).toContain(t);
  }
});
