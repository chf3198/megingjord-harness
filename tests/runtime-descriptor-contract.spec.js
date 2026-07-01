// tests/runtime-descriptor.spec.js — Epic #3411 T1.2 (#3440).
// Strategy: contract-test. Each runtime descriptor round-trips against the live
// registries (detect-runtime.js, deploy.sh, team-model-signatures.json) so it
// cannot silently drift from the runtime it describes.
'use strict';

const { test, expect } = require('@playwright/test');
const fs = require('fs');
const path = require('path');
const rd = require('../scripts/global/runtime-descriptor');

const REPO_ROOT = path.resolve(__dirname, '..');
const EXPECTED = ['antigravity', 'claude-code', 'codex', 'copilot', 'cursor'];

test('all five runtime descriptors validate and round-trip', () => {
  const res = rd.validateAll();
  expect(res.errors).toEqual([]);
  expect(res.ok).toBe(true);
});

test('exactly the five implemented runtimes are described', () => {
  expect(rd.listRuntimes().slice().sort()).toEqual(EXPECTED);
});

test('descriptor set matches the catalog runtimes list (SSoT alignment)', () => {
  const catalog = JSON.parse(fs.readFileSync(path.join(REPO_ROOT, 'inventory', 'harness-feature-catalog.json'), 'utf8'));
  expect(rd.listRuntimes().slice().sort()).toEqual(catalog.runtimes.slice().sort());
});

test('every descriptor validates against the committed schema shape', () => {
  const schema = JSON.parse(fs.readFileSync(path.join(REPO_ROOT, 'inventory', 'runtime-descriptor.schema.json'), 'utf8'));
  expect(schema.$schema).toContain('2020-12');
  for (const runtime of rd.listRuntimes()) {
    const descriptor = rd.loadDescriptor(runtime);
    for (const key of schema.required) expect(descriptor[key]).toBeTruthy();
    expect(descriptor.deploy.artifactClasses.length).toBeGreaterThan(0);
  }
});

test('detection markers equal detect-runtime.js for env-marker runtimes', () => {
  for (const runtime of rd.listRuntimes()) {
    const descriptor = rd.loadDescriptor(runtime);
    if (descriptor.detection.deltaKind !== 'env-marker') continue;
    const live = rd.liveEnvMarkers(runtime);
    expect(descriptor.detection.primaryEnvMarkers.slice().sort()).toEqual(live.slice().sort());
  }
});

test('copilot uses the ai-agent-value deltaKind (the #3041 detection gap)', () => {
  const copilot = rd.loadDescriptor('copilot');
  expect(copilot.detection.deltaKind).toBe('ai-agent-value');
  expect(copilot.parityWaivers.some((w) => w.surface === 'detect-runtime-primary-marker')).toBe(true);
});

test('cursor and antigravity waive the scripts artifactClass with a promotionPath', () => {
  for (const runtime of ['cursor', 'antigravity']) {
    const descriptor = rd.loadDescriptor(runtime);
    const waiver = descriptor.parityWaivers.find((w) => w.surface === 'scripts');
    expect(waiver).toBeTruthy();
    expect(waiver.promotionPath).toContain('T2.3');
  }
});
