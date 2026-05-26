#!/usr/bin/env node
// fleet-hamr-replay — runs corpus entries from tests/regression/fleet-hamr-corpus/*.json
// Refs Epic #2150 #2203. CI runs per-PR + nightly.

'use strict';
const fs = require('node:fs');
const path = require('node:path');

const CORPUS_DIR = path.join(__dirname, '..', '..', 'tests', 'regression', 'fleet-hamr-corpus');
const REPO_ROOT = path.join(__dirname, '..', '..');

function loadCorpus(corpusDir = CORPUS_DIR) {
  return fs.readdirSync(corpusDir)
    .filter(f => f.endsWith('.json'))
    .map(f => ({ file: f, ...JSON.parse(fs.readFileSync(path.join(corpusDir, f), 'utf8')) }));
}

function checkModuleExports(modulePath, expectedExports) {
  const full = path.join(REPO_ROOT, modulePath);
  if (!fs.existsSync(full)) return { ok: false, reason: `module not found: ${modulePath}` };
  const mod = require(full);
  for (const name of expectedExports) {
    if (typeof mod[name] === 'undefined') return { ok: false, reason: `export '${name}' missing` };
  }
  return { ok: true };
}

function runScenario(scenario) {
  const assertSpec = scenario.assertion;
  if (!assertSpec) return { ok: false, reason: 'no assertion block' };
  const exportsCheck = checkModuleExports(assertSpec.module, assertSpec.exports || []);
  if (!exportsCheck.ok) return exportsCheck;
  const mod = require(path.join(REPO_ROOT, assertSpec.module));
  if (assertSpec.tier_must_exist) {
    const map = mod.TIER_PROVIDER_MAP || {};
    if (!map[assertSpec.tier_must_exist]) return { ok: false, reason: `tier '${assertSpec.tier_must_exist}' missing` };
    if (assertSpec.tier_must_map_to && !map[assertSpec.tier_must_exist].includes(assertSpec.tier_must_map_to)) {
      return { ok: false, reason: `tier '${assertSpec.tier_must_exist}' does not map to '${assertSpec.tier_must_map_to}'` };
    }
  }
  if (assertSpec.policy_check) {
    const ms = mod.getTimeout({ model: assertSpec.policy_check.model });
    if (ms < assertSpec.policy_check.min_ms) return { ok: false, reason: `timeout ${ms}ms < min ${assertSpec.policy_check.min_ms}` };
  }
  if (assertSpec.predicate_check) {
    const result = mod.childProgressComplete(assertSpec.predicate_check.input_child, assertSpec.predicate_check.input_comments);
    if (result !== assertSpec.predicate_check.expected_result) {
      return { ok: false, reason: `predicate returned ${result}, expected ${assertSpec.predicate_check.expected_result}` };
    }
  }
  return { ok: true };
}

function runAll(corpusDir) {
  const corpus = loadCorpus(corpusDir);
  const results = corpus.map(scenario => ({ id: scenario.id, ...runScenario(scenario) }));
  return { total: results.length, passed: results.filter(r => r.ok).length, failed: results.filter(r => !r.ok), results };
}

if (require.main === module) {
  const summary = runAll();
  console.log(`fleet-hamr-replay: ${summary.passed}/${summary.total} pass`);
  for (const res of summary.results) console.log(`  ${res.ok ? '✓' : '✗'} ${res.id}${res.ok ? '' : ' — ' + res.reason}`);
  process.exit(summary.failed.length > 0 ? 1 : 0);
}

module.exports = { loadCorpus, runScenario, runAll, checkModuleExports };
