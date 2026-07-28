// #3820 (Epic #3807 C6 Option B): the two checks relocated from the retired,
// CI-dormant signer-format-canonical.js (#1536) now live in the CI-wired
// signer-fidelity.js. They ship ADVISORY, so a violation populates `violations`
// but does NOT flip `ok` to false — asserting on rule presence, not ok, is what
// proves the property is preserved without newly-blocking any artifact.
const { test, expect } = require('@playwright/test');
const fidelity = require('../scripts/global/megalint/signer-fidelity');

const canonicalBlock = `Signed-by: Orla Mason
Team&Model: claude-code:opus-4-7@anthropic
Role: manager`;

const copilotEpicAntipattern =
  'Manager: curtisfranks | GitHub Copilot (Claude Sonnet 4.6 @ github-copilot) | 2026-05-14';

const hasRule = (result, rule) => (result.violations || []).some((v) => v.rule === rule);

// --- role-prefix-as-provenance (Epic #1526 anti-pattern) ---

test('#3820 AC1: canonical 3-line block raises no format violation', () => {
  const result = fidelity.validate({ body: canonicalBlock });
  expect(hasRule(result, 'role-prefix-as-provenance')).toBe(false);
  expect(hasRule(result, 'team-model-not-canonical')).toBe(false);
});

test('#3820 AC1: Epic #1526 role-prefix anti-pattern is caught (relocated)', () => {
  const result = fidelity.validate({ body: `Body text.\n\n${copilotEpicAntipattern}` });
  expect(hasRule(result, 'role-prefix-as-provenance')).toBe(true);
  const v = result.violations.find((x) => x.rule === 'role-prefix-as-provenance');
  expect(v.severity).toBe('advisory');
  expect(v.detail).toContain('Manager:');
});

test('#3820 AC1: all four role prefixes detected', () => {
  for (const role of ['Manager', 'Collaborator', 'Admin', 'Consultant']) {
    const result = fidelity.validate({ body: `${role}: someone | agent | 2026-05-14` });
    expect(hasRule(result, 'role-prefix-as-provenance'), role).toBe(true);
  }
});

test('#3820 AC4: lowercase "manager:" in narrative does NOT trigger (false-positive guard)', () => {
  const result = fidelity.validate({ body: 'the manager: someone approves this | next step | done' });
  expect(hasRule(result, 'role-prefix-as-provenance')).toBe(false);
});

test('#3820 AC4: heading "## Manager Provenance" does NOT trigger (false-positive guard)', () => {
  const result = fidelity.validate({ body: '## Manager Provenance\n\nSomething here.' });
  expect(hasRule(result, 'role-prefix-as-provenance')).toBe(false);
});

test('#3820 AC4: role-prefix WITHOUT pipe separator does NOT trigger', () => {
  const result = fidelity.validate({ body: 'Manager: Orla Mason\nAdmin: Orla Reyes' });
  expect(hasRule(result, 'role-prefix-as-provenance')).toBe(false);
});

test('#3820: real Epic #1526 antipattern caught inside PR-like context', () => {
  const body = `## Some PR body\n\nDetails.\n\n## Team&Model Provenance\n\n${copilotEpicAntipattern}`;
  expect(hasRule(fidelity.validate({ body }), 'role-prefix-as-provenance')).toBe(true);
});

test('#3820: multiple role-prefix lines all flagged', () => {
  const result = fidelity.validate({ body: `Manager: a | b | c\n\nCollaborator: d | e | f` });
  const flagged = result.violations.filter((v) => v.rule === 'role-prefix-as-provenance');
  expect(flagged).toHaveLength(2);
});

// --- team-model-not-canonical ---

test('#3820 AC2: canonical Team&Model recognized by regex', () => {
  const re = fidelity.TEAM_MODEL_CANONICAL_RE;
  expect(re.test('Team&Model: claude-code:opus-4-7@anthropic')).toBe(true);
  expect(re.test('Team&Model: copilot:gpt-5.3-codex@github')).toBe(true);
  expect(re.test('Team&Model: codex:gpt-5.4@codex-cli')).toBe(true);
  expect(re.test('Team&Model: openclaw:qwen@local/windows-laptop')).toBe(true);
});

test('#3820 AC2: malformed Team&Model fails canonical regex', () => {
  const re = fidelity.TEAM_MODEL_CANONICAL_RE;
  expect(re.test('Team&Model: GitHub Copilot (Claude Sonnet)')).toBe(false);
  expect(re.test('Team&Model: just-a-name')).toBe(false);
  expect(re.test('Team&Model:claude-code @anthropic')).toBe(false);
});

test('#3820 AC2: Signed-by without canonical Team&Model is flagged', () => {
  const body = `Signed-by: Orla Mason\nNo Team&Model line here.\nRole: manager`;
  expect(hasRule(fidelity.validate({ body }), 'team-model-not-canonical')).toBe(true);
});

test('#3820 AC2: Signed-by with MALFORMED Team&Model is flagged', () => {
  const body = `Signed-by: Orla Mason\nTeam&Model: GitHub Copilot (Claude Sonnet 4.6)\nRole: manager`;
  expect(hasRule(fidelity.validate({ body }), 'team-model-not-canonical')).toBe(true);
});

test('#3820 AC2: body without Signed-by skips the Team&Model check (no false positive)', () => {
  const body = 'Just narrative text. No signer block.';
  expect(hasRule(fidelity.validate({ body }), 'team-model-not-canonical')).toBe(false);
});

test('#3820: empty/null body is safe', () => {
  expect(() => fidelity.validate({ body: '' })).not.toThrow();
  expect(() => fidelity.validate({})).not.toThrow();
  expect(() => fidelity.validate({ body: null })).not.toThrow();
  expect(hasRule(fidelity.validate({ body: '' }), 'role-prefix-as-provenance')).toBe(false);
});

test('#3820 AC3: advisory relocation does NOT newly-block a canonical artifact (ok stays true)', () => {
  // ok reflects only non-advisory violations — the whole "no newly-blocked" guarantee.
  expect(fidelity.validate({ body: canonicalBlock }).ok).toBe(true);
  // even a body that trips the advisory format rules keeps ok=true (advisory, not blocking).
  expect(fidelity.validate({ body: copilotEpicAntipattern }).ok).toBe(true);
});

test('#3820 AC2: retired validator file is gone', () => {
  const fs = require('fs');
  const path = require('path');
  const p = path.join(__dirname, '..', 'scripts', 'global', 'megalint', 'signer-format-canonical.js');
  expect(fs.existsSync(p)).toBe(false);
});

test('#3820 AC2: retired key removed from megalint VALIDATORS map', () => {
  const megalint = require('../scripts/global/megalint');
  expect(megalint.VALIDATORS).not.toHaveProperty('signer-format-canonical');
  expect(megalint.VALIDATORS).toHaveProperty('signer-fidelity');
});
