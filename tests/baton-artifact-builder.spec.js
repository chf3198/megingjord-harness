// Unit tests for the schema-validated baton-artifact builder (Epic #2037 P1.1,
// Refs #2671). Uses @playwright/test to run in the quality-gates deterministic
// unit-test list. Covers determinism (byte-identical), validation, signer
// derivation, the Role: signing-line trap-fix, and the impure JSONL emit.
const { test, expect } = require('@playwright/test');
const {
  buildArtifact, deriveSigner, emitBuildDecision,
} = require('../scripts/global/baton-artifact-builder');
const { ARTIFACT_SPECS } = require('../scripts/global/baton-artifact-schema');

const TM = 'claude-code:opus@anthropic';

function managerInput() {
  return {
    artifact: 'MANAGER_HANDOFF', role: 'manager', teamModel: TM,
    fields: {
      scope: 'do the thing', lane: 'lane:code-change', test_strategy: 'tdd-pyramid',
      acceptance: '- AC1 works', gates: 'lint, test',
      related_tickets: 'none', overlap_decision: 'no-overlap',
    },
  };
}

test('signer is DERIVED from teamModel, never hand-typed', () => {
  expect(deriveSigner(TM, 'manager')).toBe('Orla Mason');
  expect(deriveSigner(TM, 'collaborator')).toBe('Orla Harper');
  expect(deriveSigner(TM, 'admin')).toBe('Orla Reyes');
  expect(deriveSigner(TM, 'consultant')).toBe('Orla Vale');
});

test('MANAGER_HANDOFF renders header, ordered fields, and a Role: signing line', () => {
  const out = buildArtifact(managerInput());
  expect(out).toMatch(/^## MANAGER_HANDOFF\n\n/);
  expect(out.indexOf('scope:')).toBeLessThan(out.indexOf('lane:'));
  expect(out.indexOf('lane:')).toBeLessThan(out.indexOf('test_strategy:'));
  expect(out).toMatch(/\nSigned-by: Orla Mason\nTeam&Model: claude-code:opus@anthropic\nRole: manager$/);
});

test('Role is a signing line — no bare role-colon prose form', () => {
  const out = buildArtifact(managerInput());
  expect(out).toMatch(/\nRole: manager$/);
  expect(/(^|\n)role:\s*manager/i.test(out.replace(/Role: manager$/, ''))).toBe(false);
});

test('byte-identical determinism: same input -> same bytes (repeat + env-invariant)', () => {
  const a = buildArtifact(managerInput());
  expect(buildArtifact(managerInput())).toBe(a);
  const saved = { ...process.env };
  process.env.AI_AGENT = 'codex'; process.env.CLAUDECODE = '';
  const c = buildArtifact(managerInput());
  process.env = saved;
  expect(c).toBe(a);
});

test('unknown field is rejected (catches typos / prose leakage)', () => {
  const bad = managerInput();
  bad.fields.scopee = 'typo';
  expect(() => buildArtifact(bad)).toThrow(/unknown field 'scopee'/);
});

test('missing required field throws', () => {
  const bad = managerInput();
  delete bad.fields.gates;
  expect(() => buildArtifact(bad)).toThrow(/missing required field 'gates'/);
});

test('MANAGER_HANDOFF enforces the #2617 overlap-handoff fields', () => {
  const bad = managerInput();
  delete bad.fields.overlap_decision;
  expect(() => buildArtifact(bad)).toThrow(/missing required field 'overlap_decision'/);
  expect(buildArtifact(managerInput())).toMatch(/\nrelated_tickets: none\noverlap_decision: no-overlap\n/);
});

test('unknown artifact / missing role / missing teamModel throw', () => {
  expect(() => buildArtifact({ artifact: 'NOPE', role: 'manager', teamModel: TM })).toThrow(/unknown artifact/);
  expect(() => buildArtifact({ artifact: 'MANAGER_HANDOFF', teamModel: TM, fields: {} })).toThrow(/role is required/);
  expect(() => buildArtifact({ artifact: 'MANAGER_HANDOFF', role: 'manager', fields: {} })).toThrow(/teamModel is required/);
});

test('all six comment artifacts build from minimal valid input', () => {
  const minimal = {
    COLLABORATOR_HANDOFF: {
      scope: 's', test_strategy: 'tdd-pyramid', per_ac_verification: '- AC1 PASS',
      cross_family_rating: '95', cross_family_reviewer: 'qwen@host', cross_family_findings: 'none',
    },
    ADMIN_HANDOFF: {
      branch: 'feat/1-x', commit: 'abc123', 'signer-independence-check': 'PASS',
      'deploy-runtime-impact': 'none',
    },
    CONSULTANT_CLOSEOUT: {
      status: 'review', verdict: 'approve_for_merge', 'verification-timestamp': '2026-01-01T00:00:00Z',
      rubric_rating: '9/10', anneal_tickets_filed: 'none', mid_flight_flaws: 'none',
    },
    EPIC_RESCOPE: { summary: 'rescoped' },
    BLOCKER_NOTE: {
      BLOCKER_NOTE: 'blocked', owner: 'mgr', unblock_condition: 'x', eta_or_review_time: 'soon',
    },
  };
  for (const [artifact, fields] of Object.entries(minimal)) {
    const role = artifact === 'CONSULTANT_CLOSEOUT' ? 'consultant' : 'collaborator';
    const out = buildArtifact({ artifact, role, teamModel: TM, ticket: 7, fields });
    expect(out).toMatch(new RegExp(`^## ${artifact}\\n`));
    expect(out).toMatch(/\nRole: /);
  }
  const admin = buildArtifact({ artifact: 'ADMIN_HANDOFF', role: 'admin', teamModel: TM, ticket: 7, fields: minimal.ADMIN_HANDOFF });
  expect(admin).toMatch(/ticket: #7/);
  expect(ARTIFACT_SPECS.EPIC_RESCOPE.ticket).toBe(false);
});

test('emitBuildDecision is impure but never throws; returns a v3 event', () => {
  const os = require('node:os'); const fs = require('node:fs'); const path = require('node:path');
  const file = path.join(os.tmpdir(), `baton-builds-test-${process.pid}.jsonl`);
  const ev = emitBuildDecision({ artifact: 'MANAGER_HANDOFF', ticket: 2671, role: 'manager' }, file, '2026-01-01T00:00:00Z');
  expect(ev.version).toBe(3);
  expect(ev.service).toBe('baton-artifact-builder');
  expect(ev.ticket).toBe('#2671');
  expect(fs.readFileSync(file, 'utf8')).toContain('artifact_built');
  fs.unlinkSync(file);
});
