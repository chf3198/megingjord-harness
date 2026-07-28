'use strict';
// Tests for C6 #2541: cross-family field consistency validators
const { test, expect } = require('@playwright/test');
const { KNOWN_FAMILIES, normalizeFamily } = require('../scripts/global/megalint/signer-fidelity.js');
const { validate: validateCollab } = require('../scripts/global/megalint/collaborator-handoff.js');
const { validate: validateAdmin } = require('../scripts/global/megalint/admin-handoff.js');

test('KNOWN_FAMILIES includes the canonical + free-cloud panel families (#3688)', () => {
  // #3688: derived from the cross-family SSoT — must recognize the $0 panel families.
  for (const f of ['anthropic', 'openai', 'qwen', 'deepseek', 'granite', 'unknown',
    'meta', 'mistral', 'google']) {
    expect(KNOWN_FAMILIES).toContain(f);
  }
});

test('normalizeFamily returns canonical values for known families (incl. #3688 panel families)', () => {
  for (const f of ['anthropic', 'openai', 'qwen', 'deepseek', 'granite', 'meta', 'mistral', 'google']) {
    expect(normalizeFamily(f)).toBe(f);
    expect(normalizeFamily(f.toUpperCase())).toBe(f);
  }
});

test('normalizeFamily returns unknown for genuinely-unrecognised strings', () => {
  expect(normalizeFamily('cohere')).toBe('unknown');
  expect(normalizeFamily('')).toBe('unknown');
  expect(normalizeFamily(null)).toBe('unknown');
});

function makeCollab(extra) {
  return { lane: 'lane:code-change', labels: [], comments: [{ body: `COLLABORATOR_HANDOFF\nSigned-by: Soren Harper\nTeam&Model: copilot:claude-sonnet@github\nRole: collaborator\ncross_family_reviewer: Qwen/2.5-Coder\ncross_family_rating: ACCEPT\nreviewer_family: ${extra}` }] };
}

test('collaborator-handoff: known reviewer_family has no unknown-family advisory', () => {
  const result = validateCollab(makeCollab('qwen'));
  const unknown = (result.violations || []).filter(v => v.rule === 'unknown-reviewer-family');
  expect(unknown).toHaveLength(0);
});

test('collaborator-handoff: a genuine free-cloud reviewer_family has no advisory (#3688)', () => {
  for (const fam of ['mistral', 'meta', 'google']) {
    const result = validateCollab(makeCollab(fam));
    const unknown = (result.violations || []).filter(v => v.rule === 'unknown-reviewer-family');
    expect(unknown, `${fam} must be recognized`).toHaveLength(0);
  }
});

test('collaborator-handoff: a genuinely-unknown reviewer_family still triggers advisory', () => {
  const result = validateCollab(makeCollab('cohere'));
  const unknown = (result.violations || []).filter(v => v.rule === 'unknown-reviewer-family');
  expect(unknown).toHaveLength(1);
  expect(unknown[0].severity).toBe('advisory');
});

function makeAdmin(includeVerified) {
  const extra = includeVerified ? '\nreviewer_family_verified: qwen' : '';
  return { lane: 'lane:code-change', comments: [
    { body: 'COLLABORATOR_HANDOFF\nSigned-by: Soren Harper\nTeam&Model: copilot:claude@github\nRole: collaborator' },
    { body: `ADMIN_HANDOFF\nSigned-by: Soren Reyes\nTeam&Model: copilot:claude@github\nRole: admin${extra}` },
  ]};
}

test('admin-handoff: present reviewer_family_verified has no advisory', () => {
  const result = validateAdmin(makeAdmin(true));
  const missing = (result.violations || []).filter(v => v.rule === 'missing-reviewer-family-verified');
  expect(missing).toHaveLength(0);
});

test('admin-handoff: absent reviewer_family_verified triggers advisory', () => {
  const result = validateAdmin(makeAdmin(false));
  const missing = (result.violations || []).filter(v => v.rule === 'missing-reviewer-family-verified');
  expect(missing).toHaveLength(1);
  expect(missing[0].severity).toBe('advisory');
});
