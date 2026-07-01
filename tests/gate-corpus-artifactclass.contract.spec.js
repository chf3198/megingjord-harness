#!/usr/bin/env node
'use strict';
// Contract test for T1.6 (#3443): scripts/gate-corpus artifactClass encoding
// for cursor + antigravity runtimes. Verifies:
//   (a) the descriptor schema accepts a gateCorpusHome field under deploy
//   (b) cursor + antigravity descriptors declare the scripts artifactClass + gateCorpusHome
//   (c) the catalog megalint-orchestrator feature encodes scripts as reachable for cursor + antigravity
//   (d) all 5 runtime descriptors still pass the runtime-descriptor validator
const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const REPO_ROOT = path.resolve(__dirname, '..');
const SCHEMA_PATH = path.join(REPO_ROOT, 'inventory', 'runtime-descriptor.schema.json');
const CATALOG_PATH = path.join(REPO_ROOT, 'inventory', 'harness-feature-catalog.json');
const RUNTIMES_DIR = path.join(REPO_ROOT, 'inventory', 'runtimes');

const { validateAll } = require('../scripts/global/runtime-descriptor.js');
const { loadCatalog, validate: validateCatalog } = require('../scripts/global/harness-feature-catalog.js');

function loadJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function loadDescriptor(runtime) {
  return loadJson(path.join(RUNTIMES_DIR, runtime + '.json'));
}

// (a) Descriptor schema accepts gateCorpusHome under deploy
describe('runtime-descriptor schema: gateCorpusHome field', () => {
  it('schema deploy object defines gateCorpusHome as an optional string', () => {
    const schema = loadJson(SCHEMA_PATH);
    const deployProps = schema.properties.deploy.properties;
    assert.ok(deployProps.gateCorpusHome, 'deploy.gateCorpusHome must be defined in schema');
    assert.equal(deployProps.gateCorpusHome.type, 'string',
      'gateCorpusHome must be typed as string');
  });

  it('schema deploy.gateCorpusHome is not in required array (backward-compatible)', () => {
    const schema = loadJson(SCHEMA_PATH);
    const required = schema.properties.deploy.required || [];
    assert.ok(!required.includes('gateCorpusHome'),
      'gateCorpusHome must be optional — not in deploy.required');
  });

  it('existing runtimes without gateCorpusHome are not broken by schema change', () => {
    // claude-code, copilot, codex all lack gateCorpusHome — descriptor validator still passes
    const result = validateAll({ roundTrip: false });
    assert.ok(result.ok, 'all descriptors still valid after schema extension: ' + result.errors.join('; '));
  });
});

// (b) cursor + antigravity descriptors declare scripts artifactClass + gateCorpusHome
describe('cursor descriptor: scripts artifactClass + gateCorpusHome', () => {
  it('cursor deploy.artifactClasses includes "scripts"', () => {
    const descriptor = loadDescriptor('cursor');
    assert.ok(
      descriptor.deploy.artifactClasses.includes('scripts'),
      'cursor.deploy.artifactClasses must include "scripts"; got: ' +
        JSON.stringify(descriptor.deploy.artifactClasses)
    );
  });

  it('cursor deploy.gateCorpusHome is set to ~/.cursor/scripts/global', () => {
    const descriptor = loadDescriptor('cursor');
    assert.equal(
      descriptor.deploy.gateCorpusHome,
      '~/.cursor/scripts/global',
      'cursor gateCorpusHome must be ~/.cursor/scripts/global'
    );
  });

  it('cursor gateCorpusHome root matches deploy.home (~/.cursor)', () => {
    const descriptor = loadDescriptor('cursor');
    const home = descriptor.deploy.home;
    const corpusHome = descriptor.deploy.gateCorpusHome;
    assert.ok(
      corpusHome.startsWith(home),
      'gateCorpusHome must be under deploy.home "' + home + '"; got "' + corpusHome + '"'
    );
  });
});

describe('antigravity descriptor: scripts artifactClass + gateCorpusHome', () => {
  it('antigravity deploy.artifactClasses includes "scripts"', () => {
    const descriptor = loadDescriptor('antigravity');
    assert.ok(
      descriptor.deploy.artifactClasses.includes('scripts'),
      'antigravity.deploy.artifactClasses must include "scripts"; got: ' +
        JSON.stringify(descriptor.deploy.artifactClasses)
    );
  });

  it('antigravity deploy.gateCorpusHome is set to ~/.antigravity/scripts/global', () => {
    const descriptor = loadDescriptor('antigravity');
    assert.equal(
      descriptor.deploy.gateCorpusHome,
      '~/.antigravity/scripts/global',
      'antigravity gateCorpusHome must be ~/.antigravity/scripts/global'
    );
  });

  it('antigravity gateCorpusHome root matches deploy.home (~/.antigravity)', () => {
    const descriptor = loadDescriptor('antigravity');
    const home = descriptor.deploy.home;
    const corpusHome = descriptor.deploy.gateCorpusHome;
    assert.ok(
      corpusHome.startsWith(home),
      'gateCorpusHome must be under deploy.home "' + home + '"; got "' + corpusHome + '"'
    );
  });
});

// Runtimes that already had "scripts" (claude-code) should still pass
describe('claude-code descriptor: scripts artifactClass unchanged', () => {
  it('claude-code still declares scripts in artifactClasses', () => {
    const descriptor = loadDescriptor('claude-code');
    assert.ok(
      descriptor.deploy.artifactClasses.includes('scripts'),
      'claude-code must retain "scripts" in artifactClasses'
    );
  });
});

// (c) Catalog encodes scripts artifactClass as reachable for cursor + antigravity
describe('harness-feature-catalog: megalint-orchestrator perRuntime for cursor + antigravity', () => {
  it('catalog loads and passes validation', () => {
    const catalog = loadCatalog();
    const result = validateCatalog(catalog);
    assert.ok(result.ok, 'catalog must be valid: ' + result.errors.join('; '));
  });

  it('megalint-orchestrator feature exists in catalog', () => {
    const catalog = loadCatalog();
    const feature = catalog.features.find((feat) => feat.id === 'megalint-orchestrator');
    assert.ok(feature, 'megalint-orchestrator feature must exist in catalog');
  });

  it('megalint-orchestrator cursor cell status is "partial" (make-reachable encoded)', () => {
    const catalog = loadCatalog();
    const feature = catalog.features.find((feat) => feat.id === 'megalint-orchestrator');
    const cell = feature.perRuntime.cursor;
    assert.ok(cell, 'perRuntime.cursor cell must exist');
    assert.equal(cell.status, 'partial',
      'cursor cell must be "partial" after T1.6 encoding; got "' + cell.status + '"');
  });

  it('megalint-orchestrator antigravity cell status is "partial" (make-reachable encoded)', () => {
    const catalog = loadCatalog();
    const feature = catalog.features.find((feat) => feat.id === 'megalint-orchestrator');
    const cell = feature.perRuntime.antigravity;
    assert.ok(cell, 'perRuntime.antigravity cell must exist');
    assert.equal(cell.status, 'partial',
      'antigravity cell must be "partial" after T1.6 encoding; got "' + cell.status + '"');
  });

  it('cursor cell evidence cites T1.6 (#3443)', () => {
    const catalog = loadCatalog();
    const feature = catalog.features.find((feat) => feat.id === 'megalint-orchestrator');
    const evidence = feature.perRuntime.cursor.evidence || '';
    assert.ok(evidence.includes('#3443'),
      'cursor cell evidence must cite #3443; got: ' + evidence);
  });

  it('antigravity cell evidence cites T1.6 (#3443)', () => {
    const catalog = loadCatalog();
    const feature = catalog.features.find((feat) => feat.id === 'megalint-orchestrator');
    const evidence = feature.perRuntime.antigravity.evidence || '';
    assert.ok(evidence.includes('#3443'),
      'antigravity cell evidence must cite #3443; got: ' + evidence);
  });

  it('cursor and antigravity cells have a promotionPath referencing #3446 (T2.3)', () => {
    const catalog = loadCatalog();
    const feature = catalog.features.find((feat) => feat.id === 'megalint-orchestrator');
    const cursorPath = feature.perRuntime.cursor.promotionPath || '';
    const antigravityPath = feature.perRuntime.antigravity.promotionPath || '';
    assert.ok(cursorPath.includes('#3446'),
      'cursor promotionPath must reference #3446; got: ' + cursorPath);
    assert.ok(antigravityPath.includes('#3446'),
      'antigravity promotionPath must reference #3446; got: ' + antigravityPath);
  });

  it('megalint-orchestrator sources include t1.6-3443', () => {
    const catalog = loadCatalog();
    const feature = catalog.features.find((feat) => feat.id === 'megalint-orchestrator');
    const sources = feature.sources || [];
    assert.ok(sources.includes('t1.6-3443'),
      'sources must include "t1.6-3443" to trace the T1.6 change; got: ' + JSON.stringify(sources));
  });
});

// (d) All 5 runtime descriptors still pass the runtime-descriptor validator
describe('runtime-descriptor validator: all 5 descriptors round-trip', () => {
  it('validateAll() returns ok=true for all 5 runtimes', () => {
    const result = validateAll({ roundTrip: true });
    assert.ok(result.ok,
      'runtime-descriptor validator must pass for all runtimes: ' + result.errors.join('; '));
  });

  it('exactly 5 descriptors are present', () => {
    const result = validateAll({ roundTrip: false });
    assert.equal(result.runtimes.length, 5,
      'expected 5 runtime descriptors; got ' + result.runtimes.length);
  });

  it('all expected runtimes are present: claude-code, copilot, codex, cursor, antigravity', () => {
    const result = validateAll({ roundTrip: false });
    const runtimeSet = new Set(result.runtimes);
    for (const expected of ['claude-code', 'copilot', 'codex', 'cursor', 'antigravity']) {
      assert.ok(runtimeSet.has(expected), 'runtime "' + expected + '" must be present');
    }
  });
});
