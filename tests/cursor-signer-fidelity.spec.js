#!/usr/bin/env node
'use strict';
// Cursor signer-alias regression (#3671). Locks the #3087 root-cause fix — Cursor
// resolves its Signed-by alias from the registry like every other team — and adds
// the substrate-mixing guard (#3671 AC5) covering the #1591 codex:gpt-5 leak.
const assert = require('assert');
const path = require('path');
const { execFileSync } = require('child_process');

const ROOT = path.join(__dirname, '..');
const { expectedAliasFor } = require(path.join(ROOT, 'scripts/global/megalint/signer-registry-check.js'));
const { validate } = require(path.join(ROOT, 'scripts/global/megalint/signer-fidelity.js'));
const { buildBatonComment } = require(path.join(ROOT, 'scripts/global/baton-comment-build.js'));

const ROLE_SURNAME = { manager: 'Mason', collaborator: 'Harper', admin: 'Reyes', consultant: 'Vale' };
let pass = 0;

// AC1 — registry maps cursor:composer@cursor to Cyrus <role-surname> for all four roles.
for (const [role, surname] of Object.entries(ROLE_SURNAME)) {
  const alias = expectedAliasFor({ team: 'cursor', model: 'composer', role });
  assert.strictEqual(alias, `Cyrus ${surname}`, `AC1 registry alias ${role}`);
  pass++;
}

// AC2 — the agent-signature CLI returns the derived alias for each role.
for (const [role, surname] of Object.entries(ROLE_SURNAME)) {
  const out = execFileSync('node', [
    path.join(ROOT, 'scripts/global/agent-signature.js'),
    '--team', 'cursor', '--model', 'composer', '--role', role,
    '--substrate', 'cursor', '--format', 'text',
  ], { encoding: 'utf8', env: { ...process.env, MEGINGJORD_QUIET_RESOLVER: '1' } });
  assert.ok(out.includes(`Signed-by: Cyrus ${surname}`), `AC2 CLI alias ${role}`);
  assert.ok(out.includes('Team&Model: cursor:composer@cursor'), `AC2 CLI team-model ${role}`);
  pass++;
}

// AC3 — the shared baton-comment builder derives the cursor alias; never emits the
// literal "Cursor Agent" string.
for (const [role, surname] of Object.entries(ROLE_SURNAME)) {
  const comment = buildBatonComment({
    artifact: role === 'manager' ? 'MANAGER_HANDOFF' : 'COLLABORATOR_HANDOFF',
    ticket: '3671', role, teamModel: 'cursor:composer@cursor',
  });
  assert.ok(comment.includes(`Signed-by: Cyrus ${surname}`), `AC3 builder alias ${role}`);
  assert.ok(!/Cursor Agent/i.test(comment), `AC3 no literal Cursor Agent ${role}`);
  pass++;
}

// AC4 — a well-formed Cursor artifact passes signer-fidelity; the literal
// "Cursor Agent" signer is rejected.
const cursorArtifact = [
  '## COLLABORATOR_HANDOFF',
  'Signed-by: Cyrus Harper',
  'Team&Model: cursor:composer@cursor',
  'Role: collaborator',
].join('\n');
assert.strictEqual(validate({ body: cursorArtifact }).ok, true, 'AC4 valid cursor artifact passes');
pass++;

const literalAgent = cursorArtifact.replace('Cyrus Harper', 'Cursor Agent');
const literalResult = validate({ body: literalAgent });
assert.strictEqual(literalResult.ok, false, 'AC4 literal Cursor Agent rejected');
assert.ok(literalResult.violations.some(v => v.rule === 'signer-alias-not-registry-derived'),
  'AC4 rejection is registry-derived-alias rule');
pass++;

// AC5 — substrate-mixing guard.
// (a) substrate resolves to cursor but team says codex → substrate-team-mismatch.
const substrateLeak = [
  '## ADMIN_HANDOFF',
  'Signed-by: Nova Reyes',
  'Team&Model: codex:gpt-5@cursor-ide',
  'Role: admin',
].join('\n');
const subResult = validate({ body: substrateLeak });
assert.strictEqual(subResult.ok, false, 'AC5 substrate/team mismatch rejected');
assert.ok(subResult.violations.some(v => v.rule === 'substrate-team-mismatch'),
  'AC5 substrate-team-mismatch rule fires');
pass++;

// (b) Cyrus seed (cursor-unique) stamped onto a non-cursor Team&Model → the #1591
// codex:gpt-5 leak.
const seedLeak = [
  '## ADMIN_HANDOFF',
  'Signed-by: Cyrus Reyes',
  'Team&Model: codex:gpt-5@openai',
  'Role: admin',
].join('\n');
const seedResult = validate({ body: seedLeak });
assert.strictEqual(seedResult.ok, false, 'AC5 cursor-seed on non-cursor team rejected');
assert.ok(seedResult.violations.some(v => v.rule === 'signer-seed-team-mismatch'),
  'AC5 signer-seed-team-mismatch rule fires');
pass++;

// (c) No false positive — a genuine codex artifact with consistent substrate passes.
const cleanCodex = [
  '## ADMIN_HANDOFF',
  'Signed-by: Quill Reyes',
  'Team&Model: codex:gpt-5.4@codex-cli',
  'Role: admin',
].join('\n');
assert.strictEqual(validate({ body: cleanCodex }).ok, true, 'AC5 clean codex artifact passes');
pass++;

// (d) No false positive — a genuine cursor artifact (cursor team + cursor substrate) passes.
const cleanCursor = [
  '## ADMIN_HANDOFF',
  'Signed-by: Cyrus Reyes',
  'Team&Model: cursor:composer@cursor-ide',
  'Role: admin',
].join('\n');
assert.strictEqual(validate({ body: cleanCursor }).ok, true, 'AC5 clean cursor artifact passes');
pass++;

// (e) No false positive — a claude-code artifact on an unmapped substrate (@local)
// is not flagged (substrate check only fires on mapped substrates).
const cleanClaude = [
  '## COLLABORATOR_HANDOFF',
  'Signed-by: Orla Harper',
  'Team&Model: claude-code:opus@local',
  'Role: collaborator',
].join('\n');
assert.strictEqual(validate({ body: cleanClaude }).ok, true, 'AC5 unmapped substrate not flagged');
pass++;

// (f) Robustness — an artifact missing Team&Model is skipped, never throws.
const noTeamModel = '## COLLABORATOR_HANDOFF\nSigned-by: Cyrus Harper\nRole: collaborator';
assert.strictEqual(validate({ body: noTeamModel }).ok, true, 'AC5 missing team-model skipped safely');
const { checkSubstrateMixing } = require(path.join(ROOT, 'scripts/global/megalint/signer-fidelity.js'));
assert.deepStrictEqual(checkSubstrateMixing('', undefined), [], 'AC5 empty body → no violations');
assert.deepStrictEqual(checkSubstrateMixing(null, undefined), [], 'AC5 null body → no violations');
pass += 3;

console.log(`cursor-signer-fidelity tests: PASS (${pass} assertions across AC1-AC5)`);
