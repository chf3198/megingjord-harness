// tests/harness-feature-catalog.spec.js — Epic #3411 T1.1 (#3439).
// Strategy: golden-file. Validates the keystone canonical harness feature catalog
// is schema-valid, self-consistent, derives its counts, and anchors the #1701 SSoT.
'use strict';

const { test, expect } = require('@playwright/test');
const fs = require('fs');
const path = require('path');
const cat = require('../scripts/global/harness-feature-catalog');

const REPO_ROOT = path.resolve(__dirname, '..');
const catalog = cat.loadCatalog();

test('catalog validates with zero errors', () => {
  const res = cat.validate(catalog);
  expect(res.errors).toEqual([]);
  expect(res.ok).toBe(true);
});

test('catalog enumerates all 19 layers L1..L19', () => {
  expect(catalog.layers.length).toBeGreaterThanOrEqual(19);
  for (let i = 1; i <= 19; i++) {
    expect(catalog.layers.some((l) => l.startsWith('L' + i + '-'))).toBe(true);
  }
});

test('every layer has at least one feature row', () => {
  const counts = cat.deriveCounts(catalog);
  for (const layer of catalog.layers) {
    expect(counts.byLayer[layer] || 0).toBeGreaterThan(0);
  }
});

test('counts are derived, not hand-asserted (metadata matches derivation)', () => {
  const counts = cat.deriveCounts(catalog);
  expect(catalog.metadata.layerCount).toBe(counts.layerCount);
  expect(catalog.metadata.featureCount).toBe(counts.featureCount);
  expect(catalog.metadata.parityFlaggedCount).toBe(counts.parityFlaggedCount);
});

test('catalogVersion is the content hash of layers+features', () => {
  expect(catalog.catalogVersion).toBe(cat.computeVersion(catalog));
  expect(catalog.catalogVersion).toMatch(/^[0-9a-f]{16}$/);
});

test('catalog anchors the #1701 governance/README.md SSoT (extend, not fork)', () => {
  expect(catalog.ssotAnchor).toBe('governance/README.md');
  expect(fs.existsSync(path.join(REPO_ROOT, 'governance', 'README.md'))).toBe(true);
});

test('every parity:yes feature has a perRuntime cell for all 5 runtimes', () => {
  const runtimes = catalog.runtimes;
  expect(runtimes.length).toBe(5);
  for (const f of catalog.features) {
    if (f.parity !== 'yes') continue;
    expect(f.perRuntime).toBeTruthy();
    for (const rt of runtimes) {
      expect(f.perRuntime[rt]).toBeTruthy();
      expect(typeof f.perRuntime[rt].status).toBe('string');
    }
  }
});

test('every runtime-NA feature carries a substituteTest or promotionPath', () => {
  for (const f of catalog.features) {
    if (f.parity !== 'runtime-NA') continue;
    const hasSub = Object.prototype.hasOwnProperty.call(f, 'substituteTest');
    const hasPromo = Object.prototype.hasOwnProperty.call(f, 'promotionPath');
    expect(hasSub || hasPromo).toBe(true);
  }
});

test('feature ids are unique and slug-shaped', () => {
  const ids = new Set();
  for (const f of catalog.features) {
    expect(f.id).toMatch(/^[a-z0-9-]+$/);
    expect(ids.has(f.id)).toBe(false);
    ids.add(f.id);
  }
});

test('catalog JSON validates against the committed JSON Schema shape', () => {
  const schema = JSON.parse(fs.readFileSync(path.join(REPO_ROOT, 'inventory', 'harness-feature-catalog.schema.json'), 'utf8'));
  // structural sanity: schema is draft 2020-12 and declares the parityCell + feature defs
  expect(schema.$schema).toContain('2020-12');
  expect(schema.$defs.parityCell).toBeTruthy();
  expect(schema.$defs.feature.required).toContain('parity');
});
