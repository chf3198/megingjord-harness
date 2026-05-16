const { test, expect } = require('@playwright/test');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');
const leaseRegistry = require('../scripts/global/cross-team-lease-registry');
const gate = require('../scripts/global/cross-team-conflict-gate');

function registryWith(input = {}) {
  const registry = { version: 1, leases: [] };
  leaseRegistry.createLease(registry, {
    ticket: 1700, team: 'copilot', role: 'collaborator',
    branch: 'feat/1700-shared-work', paths: 'scripts/global',
    runtime_surfaces: 'github', ...input,
  });
  return registry;
}

test('allows non-conflicting paths and branches', () => {
  const result = gate.evaluate(registryWith(), {
    ticket: 1619, branch: 'feat/1619-pre-edit-conflict-gate', paths: 'docs',
  });
  expect(result.ok).toBe(true);
  expect(result.findings).toEqual([]);
});

test('ignores the caller lease when ticket and branch match', () => {
  const result = gate.evaluate(registryWith({
    ticket: 1619, branch: 'feat/1619-pre-edit-conflict-gate',
  }), {
    ticket: 1619, branch: 'feat/1619-pre-edit-conflict-gate',
    paths: 'scripts/global',
  });
  expect(result.ok).toBe(true);
});

test('blocks duplicate active branch claims', () => {
  const result = gate.evaluate(registryWith(), {
    ticket: 1619, branch: 'feat/1700-shared-work', paths: 'docs',
  });
  expect(result.ok).toBe(false);
  expect(result.findings[0].detail).toContain('branch already claimed');
});

test('blocks same-ticket path collisions', () => {
  const result = gate.evaluate(registryWith({ ticket: 1619 }), {
    ticket: 1619, branch: 'feat/1619-other', paths: 'scripts/global/hooks.js',
  });
  expect(result.ok).toBe(false);
  expect(result.findings[0].detail).toContain('same-ticket path collision');
});

test('warns on adjacent governance surfaces', () => {
  const result = gate.evaluate(registryWith({ paths: 'instructions' }), {
    ticket: 1619, branch: 'feat/1619-other', paths: '.github/workflows',
  });
  expect(result.ok).toBe(true);
  expect(result.findings[0].kind).toBe('warn');
});

test('ignores expired leases', () => {
  const registry = registryWith();
  registry.leases[0].expires_at = '2026-01-01T00:00:00.000Z';
  registry.leases[0].status = 'expired';
  expect(gate.evaluate(registry, {
    ticket: 1700, branch: 'feat/1700-shared-work', paths: 'scripts/global',
  }).ok).toBe(true);
});

test('manager override downgrades blocks to warnings', () => {
  const result = gate.evaluate(registryWith(), {
    ticket: 1619, branch: 'feat/1700-shared-work', paths: 'docs',
    manager_override: '#1619',
  });
  expect(result.ok).toBe(true);
  expect(result.findings[0].kind).toBe('warn');
});

test('CLI exits with 2 when blocked and prints evidence JSON', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'conflict-gate-'));
  const file = path.join(dir, 'leases.json');
  leaseRegistry.write(registryWith(), file);
  const cli = path.resolve(__dirname, '..', 'scripts', 'global', 'cross-team-conflict-gate.js');
  const run = spawnSync('node', [cli, '--file', file, '--ticket', '1619',
    '--branch', 'feat/1700-shared-work', '--paths', 'docs'], { encoding: 'utf8' });
  expect(run.status).toBe(2);
  expect(JSON.parse(run.stdout).ok).toBe(false);
});
