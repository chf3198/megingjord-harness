#!/usr/bin/env node
'use strict';
// Canonical Harness Feature Catalog loader/validator (Epic #3411 T1.1, keystone).
// The catalog (inventory/harness-feature-catalog.json) is the single source of
// truth from which one-step onboarding (T2) and the per-feature x per-orchestrator
// parity matrix (T3) derive. This module EXTENDS the #1701 governance/README.md ->
// governance-manifest chain (it asserts the anchor exists); it does not fork it.
//
// Validation is self-contained (zero-dep, deterministic) so it runs in any runtime
// without an ajv/2020-12 dialect dependency. The committed JSON Schema
// (harness-feature-catalog.schema.json) remains the external-tooling contract.
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const REPO_ROOT = path.resolve(__dirname, '..', '..');
const CATALOG_PATH = path.join(REPO_ROOT, 'inventory', 'harness-feature-catalog.json');
const SSOT_ANCHOR = 'governance/README.md';
const PARITY_ENUM = new Set(['yes', 'no', 'runtime-NA']);
const CELL_STATUS = new Set(['full', 'partial', 'absent', 'structural-NA', 'waived', 'advisory-backstop-exists', 'unverified']);
const SUBSTITUTE_REQUIRED = new Set(['structural-NA', 'waived']);

function loadCatalog(file) {
  const raw = fs.readFileSync(file || CATALOG_PATH, 'utf8');
  return JSON.parse(raw);
}

// Deterministic content hash over the parity-bearing payload, mirroring
// team-model-signatures.json#registryVersion. Must match catalogVersion.
function computeVersion(catalog) {
  const canon = JSON.stringify({ layers: catalog.layers, features: catalog.features });
  return crypto.createHash('sha256').update(canon).digest('hex').slice(0, 16);
}

// Counts are DERIVED here, never read from metadata (the AC: never hand-asserted).
function deriveCounts(catalog) {
  const features = catalog.features || [];
  const byLayer = {};
  for (const f of features) byLayer[f.layer] = (byLayer[f.layer] || 0) + 1;
  return {
    layerCount: (catalog.layers || []).length,
    featureCount: features.length,
    parityFlaggedCount: features.filter((f) => f.parity === 'yes').length,
    nonParityCount: features.filter((f) => f.parity === 'no').length,
    runtimeNACount: features.filter((f) => f.parity === 'runtime-NA').length,
    byLayer,
  };
}

function validate(catalog, opts) {
  const options = opts || {};
  const errors = [];
  const layerSet = new Set(catalog.layers || []);
  const runtimes = catalog.runtimes || [];

  if (catalog.ssotAnchor !== SSOT_ANCHOR) {
    errors.push('ssotAnchor must be "' + SSOT_ANCHOR + '" (extend-not-fork the #1701 chain); got "' + catalog.ssotAnchor + '"');
  }
  // Anchor must physically exist — the catalog extends a real upstream SSoT.
  if (options.checkAnchor !== false && !fs.existsSync(path.join(REPO_ROOT, SSOT_ANCHOR))) {
    errors.push('SSoT anchor file missing on disk: ' + SSOT_ANCHOR);
  }
  if (!Array.isArray(catalog.layers) || catalog.layers.length < 19) {
    errors.push('layers must list at least 19 entries; got ' + (catalog.layers || []).length);
  }

  const ids = new Set();
  for (const f of catalog.features || []) {
    const where = f && f.id ? 'feature "' + f.id + '"' : 'feature ' + JSON.stringify(f).slice(0, 60);
    if (!f.id || !/^[a-z0-9-]+$/.test(f.id)) errors.push(where + ': bad/missing id');
    if (ids.has(f.id)) errors.push(where + ': duplicate id');
    ids.add(f.id);
    if (!f.name) errors.push(where + ': missing name');
    if (!layerSet.has(f.layer)) errors.push(where + ': layer "' + f.layer + '" not in catalog.layers');
    if (!PARITY_ENUM.has(f.parity)) errors.push(where + ': parity "' + f.parity + '" not in {yes,no,runtime-NA}');

    if (f.parity === 'yes') {
      if (!f.perRuntime || typeof f.perRuntime !== 'object') {
        errors.push(where + ': parity:yes requires a perRuntime block');
      } else {
        for (const rt of runtimes) {
          const cell = f.perRuntime[rt];
          if (!cell) { errors.push(where + ': perRuntime missing runtime "' + rt + '"'); continue; }
          if (!CELL_STATUS.has(cell.status)) errors.push(where + '.' + rt + ': bad cell status "' + cell.status + '"');
          if (SUBSTITUTE_REQUIRED.has(cell.status) && !(cell.substituteTest && String(cell.substituteTest).length)) {
            errors.push(where + '.' + rt + ': status "' + cell.status + '" requires a non-empty substituteTest');
          }
        }
      }
    }
    if (f.parity === 'runtime-NA' && !('substituteTest' in f) && !('promotionPath' in f)) {
      errors.push(where + ': runtime-NA requires a substituteTest or promotionPath');
    }
  }

  const versionExpected = computeVersion(catalog);
  if (catalog.catalogVersion !== versionExpected) {
    errors.push('catalogVersion stale: file="' + catalog.catalogVersion + '" expected="' + versionExpected + '" (run catalog:check --fix)');
  }
  const counts = deriveCounts(catalog);
  const md = catalog.metadata || {};
  for (const k of ['layerCount', 'featureCount', 'parityFlaggedCount']) {
    if (md[k] !== counts[k]) errors.push('metadata.' + k + '=' + md[k] + ' disagrees with derived ' + counts[k] + ' (counts must be derived, never hand-asserted)');
  }
  return { ok: errors.length === 0, errors, counts, versionExpected };
}

function fixCounts(catalog) {
  const counts = deriveCounts(catalog);
  catalog.metadata = Object.assign({}, catalog.metadata, {
    layerCount: counts.layerCount, featureCount: counts.featureCount,
    parityFlaggedCount: counts.parityFlaggedCount, nonParityCount: counts.nonParityCount,
    runtimeNACount: counts.runtimeNACount,
  });
  catalog.catalogVersion = computeVersion(catalog);
  return catalog;
}

module.exports = { loadCatalog, validate, deriveCounts, computeVersion, fixCounts, CATALOG_PATH };

if (require.main === module) {
  const args = process.argv.slice(2);
  const asJson = args.includes('--json');
  let catalog;
  try { catalog = loadCatalog(); }
  catch (e) { console.error('catalog load failed: ' + e.message); process.exit(2); }

  if (args.includes('--fix')) {
    fixCounts(catalog);
    fs.writeFileSync(CATALOG_PATH, JSON.stringify(catalog, null, 2) + '\n');
    console.log('catalog:fix wrote derived counts + catalogVersion=' + catalog.catalogVersion);
    process.exit(0);
  }
  const res = validate(catalog);
  if (asJson) {
    console.log(JSON.stringify({ ok: res.ok, counts: res.counts, version: catalog.catalogVersion, errors: res.errors }, null, 2));
  } else if (res.ok) {
    const c = res.counts;
    console.log('catalog OK: ' + c.layerCount + ' layers, ' + c.featureCount + ' features (' + c.parityFlaggedCount + ' parity-flagged, ' + c.runtimeNACount + ' runtime-NA), version ' + catalog.catalogVersion);
  } else {
    console.error('catalog INVALID (' + res.errors.length + ' errors):');
    for (const e of res.errors.slice(0, 50)) console.error('  - ' + e);
  }
  process.exit(res.ok ? 0 : 1);
}
