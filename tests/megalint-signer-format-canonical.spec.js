// Tests for scripts/global/megalint/signer-format-canonical.js (#1536).
const { test, expect } = require('@playwright/test');
const rule = require('../scripts/global/megalint/signer-format-canonical');

const canonicalBlock = `Signed-by: Orla Mason
Team&Model: claude-code:opus-4-7@anthropic
Role: manager`;

const copilotEpicAntipattern =
  'Manager: curtisfranks | GitHub Copilot (Claude Sonnet 4.6 @ github-copilot) | 2026-05-14';

test('#1536 AC1: canonical 3-line block passes', () => {
  expect(rule.validate({ body: canonicalBlock }).ok).toBe(true);
});

test('#1536 AC1: Epic #1526 role-prefix anti-pattern fails (role-prefix-as-provenance)', () => {
  const result = rule.validate({ body: `Body text.\n\n${copilotEpicAntipattern}` });
  expect(result.ok).toBe(false);
  expect(result.violations[0].rule).toBe('role-prefix-as-provenance');
  expect(result.violations[0].line).toContain('Manager:');
});

test('#1536 AC1: all four role prefixes detected', () => {
  for (const role of ['Manager', 'Collaborator', 'Admin', 'Consultant']) {
    const result = rule.validate({ body: `${role}: someone | agent | 2026-05-14` });
    expect(result.ok, role).toBe(false);
  }
});

test('#1536 AC1: lowercase "manager:" in narrative does NOT trigger (false-positive guard)', () => {
  const body = 'the manager: someone approves this | next step | done';
  expect(rule.validate({ body }).ok).toBe(true);
});

test('#1536 AC1: heading "## Manager Provenance" does NOT trigger (false-positive guard)', () => {
  const body = '## Manager Provenance\n\nSomething here.';
  expect(rule.validate({ body }).ok).toBe(true);
});

test('#1536 AC1: role-prefix WITHOUT pipe separator does NOT trigger', () => {
  // "Manager: <name>" with no pipe is a legitimate label in some contexts.
  const body = 'Manager: Orla Mason\nAdmin: Orla Reyes';
  expect(rule.validate({ body }).ok).toBe(true);
});

test('#1536 AC2: canonical Team&Model passes', () => {
  expect(rule.hasCanonicalTeamModel('Team&Model: claude-code:opus-4-7@anthropic')).toBe(true);
  expect(rule.hasCanonicalTeamModel('Team&Model: copilot:gpt-5.3-codex@github')).toBe(true);
  expect(rule.hasCanonicalTeamModel('Team&Model: codex:gpt-5.4@codex-cli')).toBe(true);
  expect(rule.hasCanonicalTeamModel('Team&Model: openclaw:qwen@local/windows-laptop')).toBe(true);
});

test('#1536 AC2: malformed Team&Model fails canonical regex', () => {
  expect(rule.hasCanonicalTeamModel('Team&Model: GitHub Copilot (Claude Sonnet)')).toBe(false);
  expect(rule.hasCanonicalTeamModel('Team&Model: just-a-name')).toBe(false);
  expect(rule.hasCanonicalTeamModel('Team&Model:claude-code @anthropic')).toBe(false);
});

test('#1536 AC2: validate flags Signed-by without canonical Team&Model', () => {
  const body = `Signed-by: Orla Mason\nNo Team&Model line here.\nRole: manager`;
  const result = rule.validate({ body });
  expect(result.ok).toBe(false);
  expect(result.violations[0].rule).toBe('team-model-not-canonical');
});

test('#1536 AC2: validate flags Signed-by with MALFORMED Team&Model', () => {
  const body = `Signed-by: Orla Mason\nTeam&Model: GitHub Copilot (Claude Sonnet 4.6)\nRole: manager`;
  const result = rule.validate({ body });
  expect(result.ok).toBe(false);
  expect(result.violations.some((v) => v.rule === 'team-model-not-canonical')).toBe(true);
});

test('#1536 AC2: body without Signed-by skips Team&Model check (no false positive)', () => {
  const body = 'Just narrative text. No signer block.';
  expect(rule.validate({ body }).ok).toBe(true);
});

test('#1536: empty/null body is safe', () => {
  expect(rule.validate({ body: '' }).ok).toBe(true);
  expect(rule.validate({}).ok).toBe(true);
  expect(rule.validate({ body: null }).ok).toBe(true);
});

test('#1536 AC4: registered in megalint VALIDATORS map and dispatchable', () => {
  const megalint = require('../scripts/global/megalint');
  expect(megalint.VALIDATORS).toHaveProperty('signer-format-canonical');
  const result = megalint.run('signer-format-canonical', { body: copilotEpicAntipattern });
  expect(result.ok).toBe(false);
});

test('#1536: real Epic #1526 antipattern caught when wrapped in PR-like context', () => {
  const body = `## Some PR body\n\nDetails here.\n\n## Team&Model Provenance\n\n${copilotEpicAntipattern}`;
  const result = rule.validate({ body });
  expect(result.ok).toBe(false);
  expect(result.violations[0].rule).toBe('role-prefix-as-provenance');
});

test('#1536: multiple role-prefix lines all flagged', () => {
  const body = `Manager: a | b | c\n\nCollaborator: d | e | f`;
  const result = rule.validate({ body });
  expect(result.violations).toHaveLength(2);
});
