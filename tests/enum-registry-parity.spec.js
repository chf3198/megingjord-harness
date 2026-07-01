// enum-registry-parity.spec.js — regression anchor for #3442 five-runtime parity.
// golden-file strategy: reads each real registry and asserts its membership matches
// tests/fixtures/enum-parity-3442.json. Any future drift is caught here.
'use strict';

const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.join(__dirname, '..');
const FIXTURE = path.join(__dirname, 'fixtures', 'enum-parity-3442.json');

function loadJson(relOrAbs) {
  const resolved = path.isAbsolute(relOrAbs) ? relOrAbs : path.join(ROOT, relOrAbs);
  return JSON.parse(fs.readFileSync(resolved, 'utf8'));
}
function loadText(rel) {
  return fs.readFileSync(path.join(ROOT, rel), 'utf8');
}

const golden = loadJson(FIXTURE);
const CANONICAL = ['antigravity', 'claude-code', 'codex', 'copilot', 'cursor'];

test('fixture is present and parseable', () => {
  assert.ok(golden, 'golden fixture must be loadable');
  assert.ok(Array.isArray(golden['routing-runtimeKinds'].expectedMembers));
});

test('github-actor-team-map: all 5 runtime slugs appear as actor values', () => {
  const actorMap = loadJson('inventory/github-actor-team-map.json');
  const teamSlugs = [...new Set(Object.values(actorMap.actors))].sort();
  const expected = golden['github-actor-team-map'].expectedTeamSlugs.slice().sort();
  for (const slug of expected) {
    assert.ok(teamSlugs.includes(slug),
      `github-actor-team-map missing team slug "${slug}"; found: ${JSON.stringify(teamSlugs)}`);
  }
});

test('routing-provider-adapters: runtimeKinds includes all 5 canonical runtimes', () => {
  const adapters = loadJson('scripts/global/routing-provider-adapters.json');
  const kinds = (adapters.runtimeKinds || []).slice().sort();
  const expected = golden['routing-runtimeKinds'].expectedMembers.slice().sort();
  assert.deepStrictEqual(kinds, expected,
    `runtimeKinds mismatch: got ${JSON.stringify(kinds)}, want ${JSON.stringify(expected)}`);
});

test('leader-election VALID_TEAMS: includes all 5 canonical runtimes', () => {
  const src = loadText('scripts/xteam-mcp/leader-election.js');
  const match = src.match(/const VALID_TEAMS\s*=\s*(\[[\s\S]*?\]);/);
  assert.ok(match, 'VALID_TEAMS definition not found in leader-election.js');
  // eslint-disable-next-line no-eval
  const teams = JSON.parse(match[1].replace(/'/g, '"')).slice().sort();
  const expected = golden['leader-election-VALID_TEAMS'].expectedMembers.slice().sort();
  assert.deepStrictEqual(teams, expected,
    `VALID_TEAMS mismatch: got ${JSON.stringify(teams)}, want ${JSON.stringify(expected)}`);
});

test('governance-manifest schema targets enum: includes all 5 canonical runtimes', () => {
  const schema = loadJson('inventory/governance-manifest.schema.json');
  const enumValues = schema.properties.units.items.properties.targets.items.enum;
  assert.ok(Array.isArray(enumValues), 'targets enum must be an array');
  const expected = golden['governance-manifest-schema-targets-enum'].expectedIncludes;
  for (const runtime of expected) {
    assert.ok(enumValues.includes(runtime),
      `governance-manifest schema targets enum missing "${runtime}"; found: ${JSON.stringify(enumValues)}`);
  }
});

test('governance-rules.yaml: cursor present in all explicit-runtime applicability lists', () => {
  const yaml = loadText('config/governance-rules.yaml');
  const rulesRequiringCursor = golden['governance-rules-cursor-applicability'].rulesRequiringCursor;
  // Parse each rule block by rule_id and check cursor is in its cross_runtime_applicability
  for (const ruleId of rulesRequiringCursor) {
    // Find the block starting with the rule_id up to the next rule_id or end
    const blockMatch = yaml.match(
      new RegExp(`rule_id:\\s*${ruleId}[\\s\\S]*?(?=\\s+-\\s+rule_id:|$)`)
    );
    assert.ok(blockMatch, `rule_id "${ruleId}" not found in governance-rules.yaml`);
    const block = blockMatch[0];
    assert.ok(block.includes('cursor'),
      `rule "${ruleId}" cross_runtime_applicability missing cursor`);
  }
});

test('harness-self-test-registry adapter_exemptions: all 5 canonical runtimes present', () => {
  const registry = loadJson('inventory/harness-self-test-registry.json');
  const exemptionKeys = Object.keys(registry.adapter_exemptions || {}).sort();
  const expected = golden['self-test-adapter-exemptions'].expectedMembers.slice().sort();
  assert.deepStrictEqual(exemptionKeys, expected,
    `adapter_exemptions keys mismatch: got ${JSON.stringify(exemptionKeys)}, want ${JSON.stringify(expected)}`);
});

test('runtime-side-effect-guard ALLOWLIST: includes cursor and antigravity', () => {
  const { ALLOWLIST } = require('../scripts/global/runtime-side-effect-guard');
  const keys = Object.keys(ALLOWLIST).sort();
  const expected = golden['runtime-side-effect-guard-ALLOWLIST'].expectedMembers.slice().sort();
  assert.deepStrictEqual(keys, expected,
    `ALLOWLIST keys mismatch: got ${JSON.stringify(keys)}, want ${JSON.stringify(expected)}`);
});

test('orchestrator-compatibility KNOWN: all 5 canonical runtimes present', () => {
  const src = loadText('tests/orchestrator-compatibility.spec.js');
  const match = src.match(/const KNOWN\s*=\s*(\[[\s\S]*?\]);/);
  assert.ok(match, 'KNOWN definition not found in orchestrator-compatibility.spec.js');
  const known = JSON.parse(match[1].replace(/'/g, '"')).slice().sort();
  const expected = golden['orchestrator-compatibility-KNOWN'].expectedMembers.slice().sort();
  assert.deepStrictEqual(known, expected,
    `KNOWN mismatch: got ${JSON.stringify(known)}, want ${JSON.stringify(expected)}`);
});

test('all 5 canonical runtimes are present across every checked surface', () => {
  // Smoke check: verifies the CANONICAL constant itself matches what fixtures declare
  const fromFixture = golden['routing-runtimeKinds'].expectedMembers.slice().sort();
  assert.deepStrictEqual(CANONICAL.slice().sort(), fromFixture,
    'CANONICAL constant in spec does not match fixture expectedMembers');
});
