#!/usr/bin/env node
'use strict';
// Tests for #1145: substrate-first team derivation
const assert = require('assert');
const { canonicalSignerAlias, deriveTeamFromSubstrate } = require('../scripts/global/signer-alias');

const registry = JSON.parse(require('fs').readFileSync(
  require('path').join(__dirname, '..', 'inventory', 'team-model-signatures.json'), 'utf8'));

let pass = 0;

// AC7: Copilot Auto routes to gpt-5.3-codex — substrate github-copilot must yield copilot team
const ac7 = canonicalSignerAlias('codex', 'collaborator', 'gpt-5.3-codex', registry, 'github-copilot');
assert.ok(ac7.startsWith('Milo') || ac7.includes('Harper') || ac7,
  `AC7 alias should derive from copilot team; got "${ac7}"`);
const ac7team = deriveTeamFromSubstrate('github-copilot', registry);
assert.strictEqual(ac7team, 'copilot', `AC7: github-copilot substrate must map to copilot team`);
pass++;

// AC2: codex-vscode-ide substrate maps to codex
assert.strictEqual(deriveTeamFromSubstrate('codex-vscode-ide', registry), 'codex', 'codex-vscode-ide → codex');
pass++;

// AC1: all canonical substrates resolve
assert.strictEqual(deriveTeamFromSubstrate('claude-code-cli', registry), 'claude-code', 'claude-code-cli');
assert.strictEqual(deriveTeamFromSubstrate('codex-cli', registry), 'codex', 'codex-cli');
assert.strictEqual(deriveTeamFromSubstrate('openclaw-gateway', registry), 'openclaw', 'openclaw-gateway');
pass += 3;

// AC6: missing substrate falls back gracefully (no substrate = null = use declared team)
assert.strictEqual(deriveTeamFromSubstrate('', registry), null, 'empty substrate → null');
assert.strictEqual(deriveTeamFromSubstrate(undefined, registry), null, 'undefined substrate → null');
pass += 2;

// device suffix stripped: "github-copilot/penguin-1" → copilot
assert.strictEqual(deriveTeamFromSubstrate('github-copilot/penguin-1', registry), 'copilot', 'device suffix stripped');
pass++;

// canonicalSignerAlias without substrate stays backwards compatible
const legacy = canonicalSignerAlias('copilot', 'manager', 'gpt-5.4-mini', registry);
assert.ok(legacy.endsWith('Mason'), `legacy path should still resolve; got "${legacy}"`);
pass++;

console.log(`substrate-team-derive.spec.js: ${pass}/9 PASS`);
