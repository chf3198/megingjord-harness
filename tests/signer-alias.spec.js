#!/usr/bin/env node
'use strict';
const assert = require('assert');
const { enforceSignerAlias, canonicalSignerAlias } = require('../scripts/global/signer-alias');

const registry = {
  defaultAliasSeed: 'Nova',
  roleSurnames: { manager: 'Mason', collaborator: 'Harper', admin: 'Reyes', consultant: 'Vale' },
  registry: [
    { team: 'copilot', modelPattern: 'gpt-5.*mini', aliasSeed: 'Milo' },
    { team: 'claude-code', modelPattern: 'opus', aliasSeed: 'Orla' },
    { team: 'codex', modelPattern: '^gpt-5\\.4$', aliasSeed: 'Quill' },
  ],
};

const matrix = [
  ['copilot', 'gpt-5.4-mini', 'Milo'],
  ['claude-code', 'opus-4-7', 'Orla'],
  ['codex', 'gpt-5.4', 'Quill'],
];
const roles = ['manager', 'collaborator', 'admin', 'consultant'];
const surnames = { manager: 'Mason', collaborator: 'Harper', admin: 'Reyes', consultant: 'Vale' };

let pass = 0;
for (const [team, model, seed] of matrix) {
  for (const role of roles) {
    const expected = `${seed} ${surnames[role]}`;
    const c = canonicalSignerAlias(team, role, model, registry);
    assert.strictEqual(c, expected, `${team}/${role} canonical`);
    const ok = enforceSignerAlias(team, role, expected, { model, registry });
    assert.strictEqual(ok.ok, true, `${team}/${role} valid alias`);
    pass++;
  }
}

const mismatch = enforceSignerAlias('copilot', 'manager', 'Wrong Mason', {
  model: 'gpt-5.4-mini', registry,
});
assert.strictEqual(mismatch.ok, false, 'mismatch should fail');
assert.strictEqual(mismatch.canonical, 'Milo Mason');

const missing = enforceSignerAlias('copilot', 'manager', '', { model: 'gpt-5.4-mini', registry });
assert.strictEqual(missing.ok, false, 'missing signer should fail');

const fallback = canonicalSignerAlias('unknown-team', 'admin', 'unknown-model', registry);
assert.strictEqual(fallback, 'Nova Reyes', 'fallback alias seed should apply');

console.log(`signer-alias tests: PASS (${pass} matrix checks + fallback/mismatch)`);
