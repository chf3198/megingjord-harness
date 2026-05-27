// signer-registry-check tests (#1451).
const { test, expect } = require('@playwright/test');
const path = require('path');
const fs = require('fs');
const os = require('os');
const R = require(path.resolve(__dirname, '..', '..', 'scripts', 'global', 'megalint', 'signer-registry-check.js'));
const Sig = require(path.resolve(__dirname, '..', '..', 'scripts', 'global', 'megalint', 'signer-fidelity.js'));

function makeRegistry() {
  const reg = {
    defaultAliasSeed: 'Nova',
    roleSurnames: { manager: 'Mason', collaborator: 'Harper', admin: 'Reyes', consultant: 'Vale' },
    registry: [
      { team: 'claude-code', modelPattern: 'opus', aliasSeed: 'Orla' },
      { team: 'codex', modelPattern: 'gpt-5.*codex', aliasSeed: 'Caden' },
      { team: 'copilot', modelPattern: 'sonnet', aliasSeed: 'Soren' },
    ],
  };
  const fileP = path.join(os.tmpdir(), `reg-${Date.now()}-${Math.random().toString(36).slice(2, 8)}.json`);
  fs.writeFileSync(fileP, JSON.stringify(reg));
  return fileP;
}

test('parseTeamModel: standard format extracts team/model/substrate', () => {
  const parsed = R.parseTeamModel('claude-code:opus-4-7@anthropic');
  expect(parsed).toEqual({ team: 'claude-code', model: 'opus-4-7', substrate: 'anthropic' });
});

test('parseTeamModel: returns null on malformed input', () => {
  expect(R.parseTeamModel('not-valid')).toBeNull();
  expect(R.parseTeamModel(null)).toBeNull();
});

test('expectedAliasFor: claude-code:opus manager → Orla Mason', () => {
  const file = makeRegistry();
  const alias = R.expectedAliasFor({ team: 'claude-code', model: 'opus-4-7', role: 'manager', registryOverride: file });
  expect(alias).toBe('Orla Mason');
  fs.unlinkSync(file);
});

test('expectedAliasFor: claude-code:opus consultant → Orla Vale', () => {
  const file = makeRegistry();
  expect(R.expectedAliasFor({ team: 'claude-code', model: 'opus-4-7', role: 'consultant', registryOverride: file })).toBe('Orla Vale');
  fs.unlinkSync(file);
});

test('expectedAliasFor: codex:gpt-5.3-codex collaborator → Caden Harper', () => {
  const file = makeRegistry();
  expect(R.expectedAliasFor({ team: 'codex', model: 'gpt-5.3-codex', role: 'collaborator', registryOverride: file })).toBe('Caden Harper');
  fs.unlinkSync(file);
});

test('expectedAliasFor: unknown team×model falls back to defaultAliasSeed', () => {
  const file = makeRegistry();
  expect(R.expectedAliasFor({ team: 'unknown', model: 'unknown', role: 'manager', registryOverride: file })).toBe('Nova Mason');
  fs.unlinkSync(file);
});

test('extractArtifactFields: pulls Signed-by / Team&Model / Role', () => {
  const body = 'work\nSigned-by: Cole Mason · Team&Model: claude-code:opus-4-7@anthropic · Role: manager';
  const fields = R.extractArtifactFields(body);
  expect(fields.signedBy).toBe('Cole Mason');
  expect(fields.teamModel).toBe('claude-code:opus-4-7@anthropic');
  expect(fields.role).toBe('manager');
});

test('extractArtifactFields: ignores prose lowercase role before signature', () => {
  const body = [
    'role: collaborator',
    'notes: prose field should not be treated as signer role',
    'Signed-by: Orla Mason',
    'Team&Model: claude-code:opus-4-7@anthropic',
    'Role: manager',
  ].join('\n');
  const fields = R.extractArtifactFields(body);
  expect(fields.role).toBe('manager');
});

test('validateArtifactAlias: drift "Cole Mason" on claude-code:opus → violation with expected="Orla Mason"', () => {
  const file = makeRegistry();
  const body = 'Signed-by: Cole Mason\nTeam&Model: claude-code:opus-4-7@anthropic\nRole: manager';
  const result = R.validateArtifactAlias(body, { registryOverride: file });
  expect(result.ok).toBe(false);
  expect(result.expected).toBe('Orla Mason');
  expect(result.actual).toBe('Cole Mason');
  expect(result.violation.rule).toBe('signer-alias-not-registry-derived');
  fs.unlinkSync(file);
});

test('validateArtifactAlias: registry-correct "Orla Mason" passes', () => {
  const file = makeRegistry();
  const body = 'Signed-by: Orla Mason\nTeam&Model: claude-code:opus-4-7@anthropic\nRole: manager';
  const result = R.validateArtifactAlias(body, { registryOverride: file });
  expect(result.ok).toBe(true);
  fs.unlinkSync(file);
});

test('validateArtifactAlias: cross-team drift "Caden Mason" on claude-code → violation', () => {
  const file = makeRegistry();
  const body = 'Signed-by: Caden Mason\nTeam&Model: claude-code:opus-4-7@anthropic\nRole: manager';
  const result = R.validateArtifactAlias(body, { registryOverride: file });
  expect(result.ok).toBe(false);
  expect(result.expected).toBe('Orla Mason');
  fs.unlinkSync(file);
});

test('validateArtifactAlias: missing Team&Model → skipped (not violation)', () => {
  const body = 'Signed-by: Orla Mason\nRole: manager';
  const result = R.validateArtifactAlias(body);
  expect(result.ok).toBe(true);
  expect(result.skipped).toBe('missing-required-fields');
});

test('validateArtifactAlias: case-insensitive name comparison', () => {
  const file = makeRegistry();
  const body = 'Signed-by: orla mason\nTeam&Model: claude-code:opus-4-7@anthropic\nRole: manager';
  expect(R.validateArtifactAlias(body, { registryOverride: file }).ok).toBe(true);
  fs.unlinkSync(file);
});

test('signer-fidelity: registry drift produces violation alongside client-identity check', () => {
  const body = 'Signed-by: Cole Vale\nTeam&Model: claude-code:opus-4-7@anthropic\nRole: consultant';
  const r = Sig.validate({ body });
  expect(r.ok).toBe(false);
  expect(r.violations.some(v => v.rule === 'signer-alias-not-registry-derived')).toBe(true);
});

test('signer-fidelity: registry-correct alias passes', () => {
  const body = 'Signed-by: Orla Vale\nTeam&Model: claude-code:opus-4-7@anthropic\nRole: consultant';
  const r = Sig.validate({ body });
  expect(r.ok).toBe(true);
});
